"use node";

import { v } from "convex/values";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { createTool, stepCountIs } from "@convex-dev/agent";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { cloneAgent } from "./agent";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "../embeddings/config";
import {
  getTestUiControlResponse,
  inferUiControlResponse,
} from "./uiControlInference";
import { isPlaywrightTestMode } from "../auth/testMode";
import type { UiControlAction } from "./uiControlTypes";

const RAG_RESULT_LIMIT = 5;
const RAG_SCORE_THRESHOLD = 0.3;
export const RAG_CHUNK_MAX_CHARS = 800;
export const RAG_CONTEXT_MAX_CHARS = 4000;
// FR-01: per-turn Anthropic output cap. Single source so retry and
// first-send paths can't drift.
const CHAT_MAX_OUTPUT_TOKENS = 1024;

const RAG_CONTEXT_HEADER = "\n\n## Relevant Content from Your Writing\n\n";

/**
 * Assembles the RAG context string that gets appended to the system prompt.
 *
 * Bounds the output per FR-08:
 *  - each chunk's text is truncated to `RAG_CHUNK_MAX_CHARS`
 *  - total concatenated string (including header) is capped at
 *    `RAG_CONTEXT_MAX_CHARS`
 *  - input order is preserved (deterministic)
 *
 * Exported so it can be unit tested without the Convex harness.
 */
export function buildRagContext(
  chunks: Array<{ title: string; chunkText: string }>,
): string {
  if (chunks.length === 0) {
    return "";
  }

  const parts: string[] = [];
  let total = RAG_CONTEXT_HEADER.length;

  for (const chunk of chunks) {
    const truncatedText = chunk.chunkText.slice(0, RAG_CHUNK_MAX_CHARS);
    const part = `### ${chunk.title}\n${truncatedText}`;
    // Account for "\n\n" separator between parts (absent before the first).
    const added = parts.length === 0 ? part.length : part.length + 2;

    if (total + added > RAG_CONTEXT_MAX_CHARS) {
      // Fit as much of this part as we can, then stop.
      const remaining = RAG_CONTEXT_MAX_CHARS - total - (parts.length === 0 ? 0 : 2);
      if (remaining > 0) {
        parts.push(part.slice(0, remaining));
      }
      break;
    }

    parts.push(part);
    total += added;
  }

  return RAG_CONTEXT_HEADER + parts.join("\n\n");
}

export const streamResponse = internalAction({
  args: {
    conversationId: v.id("conversations"),
    profileOwnerId: v.id("users"),
    promptMessageId: v.optional(v.string()),
    lockStartedAt: v.number(),
    userMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { conversationId, profileOwnerId, promptMessageId, lockStartedAt, userMessage }) => {
    try {
      const { threadId, systemPrompt } = await ctx.runQuery(
        internal.chat.helpers.loadStreamingContext,
        { conversationId, profileOwnerId },
      );

      // RAG: embed user message and retrieve relevant content
      // For retries, fetch the last user message from the thread
      const ragQuery = userMessage ?? await ctx.runQuery(
        internal.chat.helpers.getLastUserMessage,
        { threadId },
      );

      let ragContext = "";
      if (ragQuery) {
        try {
          const { embedding } = await embed({
            model: google.textEmbeddingModel(EMBEDDING_MODEL),
            value: ragQuery,
            providerOptions: {
              google: { outputDimensionality: EMBEDDING_DIMENSIONS },
            },
          });

          const vectorResults = await ctx.vectorSearch(
            "contentEmbeddings",
            "by_embedding",
            {
              vector: embedding,
              limit: RAG_RESULT_LIMIT,
              filter: (q) => q.eq("userId", profileOwnerId),
            },
          );

          // Filter by score threshold to avoid injecting irrelevant content
          const relevantResults = vectorResults.filter(
            (r) => r._score >= RAG_SCORE_THRESHOLD,
          );

          if (relevantResults.length > 0) {
            const chunks = await ctx.runQuery(
              internal.embeddings.queries.fetchChunksByIds,
              { ids: relevantResults.map((r) => r._id) },
            );

            if (chunks.length > 0) {
              ragContext = buildRagContext(
                chunks as Array<{ title: string; chunkText: string }>,
              );
            }
          }
        } catch (error) {
          console.error("RAG retrieval failed, continuing without context:", error);
        }
      }

      const fullSystemPrompt = systemPrompt + ragContext;

      const uiControlResponse = isPlaywrightTestMode() && userMessage
        ? getTestUiControlResponse(userMessage) ?? inferUiControlResponse(userMessage)
        : userMessage
          ? inferUiControlResponse(userMessage)
          : null;

      if (uiControlResponse) {
        await ctx.runMutation(internal.chat.uiControl.enqueueValidated, {
          conversationId,
          profileOwnerId,
          actions: uiControlResponse.actions,
        });
        await ctx.runMutation(internal.chat.mutations.saveAssistantMessage, {
          conversationId,
          content: uiControlResponse.confirmation,
        });
        return null;
      }

      const { thread } = await cloneAgent.continueThread(ctx, { threadId });
      const controlUiTool = createTool({
        description:
          "Queue read-only Mirror UI control actions for visible posts and articles. Use this for requests to show, open, search, filter, sort, or clear profile content. Never use it to create, edit, publish, delete, or save anything.",
        args: z.object({
          actions: z.array(
            z.union([
              z.object({
                type: z.literal("navigate"),
                kind: z.union([z.literal("posts"), z.literal("articles")]),
                slug: z.string().optional(),
              }),
              z.object({
                type: z.literal("setListControls"),
                kind: z.union([z.literal("posts"), z.literal("articles")]),
                searchQuery: z.string().optional(),
                sortOrder: z.union([z.literal("newest"), z.literal("oldest")])
                  .optional(),
                categories: z.array(z.string()).optional(),
                publishedDatePreset: z.union([
                  z.literal("today"),
                  z.literal("this_week"),
                  z.literal("this_month"),
                  z.literal("this_year"),
                ]).optional(),
              }),
              z.object({
                type: z.literal("clearListControls"),
                kind: z.union([z.literal("posts"), z.literal("articles")]),
              }),
            ]),
          ).min(1).max(3),
        }),
        ctx: ctx as any,
        handler: async (toolCtx, args) => {
          return await toolCtx.runMutation(
            internal.chat.uiControl.enqueueValidated,
            {
              conversationId,
              profileOwnerId,
              actions: args.actions as UiControlAction[],
            },
          );
        },
      });

      // Empty or undefined promptMessageId = retry: respond to latest user message.
      // `maxOutputTokens` comes from `CHAT_MAX_OUTPUT_TOKENS` so both paths
      // stay pinned to the same per-turn Anthropic cap (FR-01).
      const streamArgs = {
        system: fullSystemPrompt,
        maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
        tools: { control_ui: controlUiTool },
        stopWhen: stepCountIs(2),
        ...(promptMessageId ? { promptMessageId } : {}),
      };

      await thread.streamText(
        streamArgs,
        { saveStreamDeltas: { throttleMs: 100 } },
      );
    } finally {
      await ctx.runMutation(
        internal.chat.mutations.clearStreamingLock,
        { conversationId, expectedStartedAt: lockStartedAt },
      );
    }

    return null;
  },
});
