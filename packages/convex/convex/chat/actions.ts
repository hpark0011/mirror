"use node";

import { v } from "convex/values";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { cloneAgent } from "./agent";
import { buildCloneTools } from "./tools";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "../embeddings/config";

const RAG_RESULT_LIMIT = 5;
const RAG_SCORE_THRESHOLD = 0.3;
export const RAG_CHUNK_MAX_CHARS = 800;
export const RAG_CONTEXT_MAX_CHARS = 4000;
// FR-01: per-turn Anthropic output cap. Single source so retry and
// first-send paths can't drift.
const CHAT_MAX_OUTPUT_TOKENS = 1024;

// Generalized header — bio entries are not "writing" and future structured
// sources (events, projects, …) won't be either. One header string that
// covers prose + structured retrieval avoids per-source-type renames.
export const RAG_CONTEXT_HEADER = "\n\n## Relevant Background and Writing\n\n";

/**
 * Assembles the RAG context string that gets appended to the system prompt.
 *
 * Bounds the output per FR-08:
 *  - each chunk's text is truncated to `RAG_CHUNK_MAX_CHARS`
 *  - total concatenated string (including header) is capped at
 *    `RAG_CONTEXT_MAX_CHARS`
 *  - input order is preserved (deterministic)
 *
 * Slug behavior:
 *  - articles/posts have a non-empty `slug` and get a `[Read more](/<slug>)`
 *    line appended after the chunk text.
 *  - bio entries are stored with `slug: undefined`. The link is omitted
 *    rather than emitted with an empty path (which would produce a
 *    malformed `/` link in the prompt).
 *
 * Exported so it can be unit tested without the Convex harness.
 */
export function buildRagContext(
  chunks: Array<{ title: string; chunkText: string; slug?: string }>,
): string {
  if (chunks.length === 0) {
    return "";
  }

  const parts: string[] = [];
  let total = RAG_CONTEXT_HEADER.length;

  for (const chunk of chunks) {
    const truncatedText = chunk.chunkText.slice(0, RAG_CHUNK_MAX_CHARS);
    const slug = chunk.slug?.trim();
    const linkLine = slug ? `\n[Read more](/${slug})` : "";
    const part = `### ${chunk.title}\n${truncatedText}${linkLine}`;
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
              // `chunks` already has `{ title, chunkText, slug? }` per
              // `fetchChunksByIds`'s validator — no cast needed. `slug` is
              // optional so bio chunks (slug undefined) and article/post
              // chunks (slug present) flow through the same path; the
              // conditional `[Read more]` link inside `buildRagContext`
              // handles the difference.
              ragContext = buildRagContext(chunks);
            }
          }
        } catch (error) {
          console.error("RAG retrieval failed, continuing without context:", error);
        }
      }

      const fullSystemPrompt = systemPrompt + ragContext;

      const { thread } = await cloneAgent.continueThread(ctx, { threadId });

      // Empty or undefined promptMessageId = retry: respond to latest user message.
      // `maxOutputTokens` comes from `CHAT_MAX_OUTPUT_TOKENS` so both paths
      // stay pinned to the same per-turn Anthropic cap (FR-01).
      // Tools attach per-call (not on the singleton agent) because they need
      // `profileOwnerId` in closure for cross-user isolation — the LLM-visible
      // input schemas have no `userId`; the factory binds it server-side.
      const streamArgs = {
        system: fullSystemPrompt,
        maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
        tools: buildCloneTools(profileOwnerId),
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
