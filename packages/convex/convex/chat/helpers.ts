import { v } from "convex/values";
import { listMessages } from "@convex-dev/agent";
import { internalQuery } from "../_generated/server";
import { components } from "../_generated/api";
import { TONE_PRESETS, type TonePreset } from "./tonePresets";

const SAFETY_PREFIX = (name: string) =>
  `You are a digital clone of ${name}. You represent their ideas and perspectives based on their writing and profile.
You must never: claim to be human, share private information not in your context, make commitments on behalf of the real person, or provide medical/legal/financial advice.`;

export const STYLE_RULES = `Write the way someone texts a friend. Plain conversational prose, no markdown.
Do not use **, *, _, or backticks for emphasis. Do not use bullet points, numbered lists, or headers.
Keep replies short — usually 1–3 sentences. If you need to mention multiple things, weave them into a sentence instead of listing them.`;

const DEFAULT_PERSONA =
  "Answer questions helpfully based on your profile information and published articles.";

export const SYSTEM_PROMPT_MAX_CHARS = 6000;

// Bound on the variable `name` substituted into SAFETY_PREFIX. Keeps the
// fixed section small enough that truncateToBudget never has to cut into
// safety content, which is the invariant composeSystemPrompt relies on.
const MAX_NAME_CHARS = 200;

const SEPARATOR = "\n\n";

/**
 * Proportionally truncates the truncatable sections so the final joined
 * system prompt fits within `SYSTEM_PROMPT_MAX_CHARS` (FR-09).
 *
 * Safety prefix and tone clause are never touched in the *normal* case —
 * they are load-bearing safety content. Only the persona/bio/topics
 * sections are proportionally shrunk.
 *
 * There is ONE pathological case: if the fixed sections alone (a very long
 * `name` producing an enormous safety prefix) already exceed the budget,
 * truncating the truncatable parts to zero isn't sufficient. The caller
 * applies a final `.slice(0, SYSTEM_PROMPT_MAX_CHARS)` hard-cap backstop so
 * the model contract (≤ 6000 chars) always holds, at the cost of cutting
 * into the safety prefix. That is the lesser evil vs. blowing the cap.
 *
 * Section ORDER is preserved: safety → style → tone → bio → persona → topics.
 */
function truncateToBudget(
  fixedParts: Array<string>,
  truncatableParts: Array<string>,
): Array<string> {
  const joinCharsCount = (n: number) => (n > 1 ? (n - 1) * SEPARATOR.length : 0);
  const total = (fixed: Array<string>, trunc: Array<string>): number => {
    const all = [...fixed, ...trunc];
    return all.reduce((s, p) => s + p.length, 0) + joinCharsCount(all.length);
  };

  if (total(fixedParts, truncatableParts) <= SYSTEM_PROMPT_MAX_CHARS) {
    return [...fixedParts, ...truncatableParts];
  }

  const fixedChars = fixedParts.reduce((s, p) => s + p.length, 0);
  const totalParts = fixedParts.length + truncatableParts.length;
  const separatorOverhead = joinCharsCount(totalParts);

  // Budget left for truncatable sections combined.
  let budget =
    SYSTEM_PROMPT_MAX_CHARS - fixedChars - separatorOverhead;
  if (budget < 0) budget = 0;

  const truncatableTotal = truncatableParts.reduce((s, p) => s + p.length, 0);

  // Proportional allocation. If there's no truncatable content, leave an
  // empty array (fixed parts alone will be passed to the final backstop).
  const shrunk: Array<string> =
    truncatableTotal === 0
      ? []
      : truncatableParts.map((p) => {
          const share = Math.floor((p.length / truncatableTotal) * budget);
          return p.slice(0, share);
        });

  // Filter out zero-length truncatable parts so they don't contribute phantom
  // separator chars when the caller joins with `\n\n`.
  const nonEmptyShrunk = shrunk.filter((p) => p.length > 0);

  return [...fixedParts, ...nonEmptyShrunk];
}

export function composeSystemPrompt(opts: {
  name?: string | null;
  bio?: string | null;
  personaPrompt?: string | null;
  tonePreset?: TonePreset | null;
  topicsToAvoid?: string | null;
}): string {
  // Bound name up front so a pathologically long value cannot force the
  // final backstop slice to cut into SAFETY_PREFIX or the tone clause.
  const rawName = opts.name || "this person";
  const name =
    rawName.length > MAX_NAME_CHARS ? rawName.slice(0, MAX_NAME_CHARS) : rawName;

  // Fixed (non-truncatable) sections — always preserved verbatim.
  // Order: safety → style → tone(optional). Style rules are product-wide
  // (the chat UI renders plain text, not markdown), so they apply regardless
  // of tone preset or persona prompt.
  const fixed: Array<string> = [SAFETY_PREFIX(name), STYLE_RULES];
  if (opts.tonePreset && opts.tonePreset in TONE_PRESETS) {
    fixed.push(TONE_PRESETS[opts.tonePreset].clause);
  }

  // Truncatable sections — bio, persona, topics. Order matches existing
  // section order (safety → style → tone → bio → persona → topics).
  const truncatable: Array<string> = [];
  if (opts.bio) {
    truncatable.push(`Bio: ${opts.bio}`);
  }
  truncatable.push(opts.personaPrompt || DEFAULT_PERSONA);
  if (opts.topicsToAvoid) {
    truncatable.push(`Avoid discussing: ${opts.topicsToAvoid}`);
  }

  // Track which truncatable slots correspond to bio/persona/topics so we can
  // reassemble in order after truncation.
  const assembled = truncateToBudget(fixed, truncatable);
  const joined = assembled.join(SEPARATOR);

  // Hard backstop. Covers the pathological case where the fixed sections
  // alone (e.g. a name long enough to make the safety prefix huge) would
  // push us over budget. Under normal inputs `truncateToBudget` already
  // keeps us strictly inside the cap and this slice is a no-op.
  return joined.length > SYSTEM_PROMPT_MAX_CHARS
    ? joined.slice(0, SYSTEM_PROMPT_MAX_CHARS)
    : joined;
}

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

    return {
      threadId: conversation.threadId,
      systemPrompt: composeSystemPrompt({
        name: profileOwner.name,
        bio: profileOwner.bio,
        personaPrompt: profileOwner.personaPrompt,
        tonePreset: profileOwner.tonePreset as TonePreset | null | undefined,
        topicsToAvoid: profileOwner.topicsToAvoid,
      }),
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
