import { v } from "convex/values";
import { listMessages } from "@convex-dev/agent";
import { internalQuery } from "../_generated/server";
import { components } from "../_generated/api";

const SAFETY_PREFIX = (name: string) =>
  `You are a digital clone of ${name}. You represent their ideas and perspectives based on their writing and profile.
You must never: claim to be human, share private information not in your context, make commitments on behalf of the real person, or provide medical/legal/financial advice.`;

const DEFAULT_PERSONA =
  "Answer questions helpfully based on your profile information and published articles.";

export const loadStreamingContext = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    profileOwnerId: v.id("users"),
  },
  returns: v.object({
    threadId: v.string(),
    systemPrompt: v.string(),
  }),
  handler: async (ctx, { conversationId, profileOwnerId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    if (conversation.profileOwnerId !== profileOwnerId) {
      throw new Error("Conversation/profile owner mismatch");
    }

    const profileOwner = await ctx.db.get(profileOwnerId);
    if (!profileOwner) {
      throw new Error("Profile owner not found");
    }

    const name = profileOwner.name || "this person";
    const parts = [SAFETY_PREFIX(name)];

    if (profileOwner.bio) {
      parts.push(`Bio: ${profileOwner.bio}`);
    }

    parts.push(profileOwner.personaPrompt || DEFAULT_PERSONA);

    return {
      threadId: conversation.threadId,
      systemPrompt: parts.join("\n\n"),
    };
  },
});

export const getLastUserMessage = internalQuery({
  args: {
    threadId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { threadId }) => {
    // Paginate through all messages to handle long threads
    let cursor: string | null = null;
    let lastUserText: string | null = null;

    while (true) {
      const result = await listMessages(ctx, components.agent, {
        threadId,
        paginationOpts: { numItems: 100, cursor },
        excludeToolMessages: true,
      });

      // Messages are in ascending order; track the latest user message
      for (const msg of result.page) {
        if (msg.message?.role !== "user") continue;

        const content = msg.message.content;
        if (typeof content === "string") {
          lastUserText = content;
          continue;
        }

        if (!Array.isArray(content)) continue;

        const text = content
          .filter(
            (p): p is { type: "text"; text: string } => p.type === "text",
          )
          .map((p) => p.text)
          .join("");
        if (text) lastUserText = text;
      }

      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    return lastUserText;
  },
});
