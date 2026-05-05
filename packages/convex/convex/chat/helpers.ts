import { v } from "convex/values";
import { listMessages } from "@convex-dev/agent";
import { internalQuery } from "../_generated/server";
import { components } from "../_generated/api";
import { TONE_PRESETS, type TonePreset } from "./tonePresets";

/**
 * Inventory of which structured RAG-ingestion sources the profile owner has
 * populated. Keys MUST stay in sync with `embeddingSourceTableValidator` in
 * `packages/convex/convex/embeddings/schema.ts` — when a literal is added
 * there, add the key here so the compiler forces a corresponding update to
 * `composeSystemPrompt`'s inventory sentence.
 */
export type ContentInventory = {
  articles: boolean;
  posts: boolean;
  bioEntries: boolean;
};

// Human-readable label for each kind in the inventory sentence. Phrasing is
// plain conversational prose to match STYLE_RULES — the agent copies the
// register from the system prompt.
const CONTENT_INVENTORY_LABELS: Record<keyof ContentInventory, string> = {
  bioEntries: "bio entries (work history, education)",
  posts: "published posts",
  articles: "published articles",
};

// Order in which kinds appear in the inventory sentence. Listed bio-first
// because that is the kind least likely to be obvious from the visitor's
// message, so naming it proactively has the most impact.
const CONTENT_INVENTORY_ORDER: ReadonlyArray<keyof ContentInventory> = [
  "bioEntries",
  "posts",
  "articles",
];

/**
 * Build the inventory sentence for the system prompt. Returns `null` when no
 * kinds are populated so the caller can omit the section entirely (preserves
 * backward compatibility for users with no structured content).
 *
 * Exported so the unit tests can target the phrasing directly.
 */
export function buildContentInventorySentence(
  inventory: ContentInventory,
): string | null {
  const present = CONTENT_INVENTORY_ORDER.filter((key) => inventory[key]);
  if (present.length === 0) return null;

  const labels = present.map((key) => CONTENT_INVENTORY_LABELS[key]);
  const list =
    labels.length === 1
      ? labels[0]
      : labels.length === 2
        ? `${labels[0]} and ${labels[1]}`
        : `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;

  return `You can speak from this person's ${list} when relevant.`;
}

const SAFETY_PREFIX = (name: string) =>
  `You are a digital clone of ${name}. You represent their ideas and perspectives based on their writing and profile.
You must never: claim to be human, share private information not in your context, make commitments on behalf of the real person, or provide medical/legal/financial advice.`;

export const STYLE_RULES = `Write the way someone texts a friend. Plain conversational prose, no markdown.
Do not use **, *, _, or backticks for emphasis. Do not use bullet points, numbered lists, or headers.
Keep replies short — usually 1–3 sentences. If you need to mention multiple things, weave them into a sentence instead of listing them.`;

const DEFAULT_PERSONA =
  "Answer questions helpfully based on your profile information and published articles.";

// Tools-vocabulary section. Tells the agent the verbs it can call to act on
// the visitor's view, not just describe content. Phrasing is plain
// conversational prose to match STYLE_RULES — no markdown, no lists. Kept
// short so it pulls little weight in the truncatable budget. Placed alongside
// the inventory sentence so the agent learns nouns ("articles", "posts") and
// verbs ("getLatestPublished", "navigateToContent") in the same region.
const TOOLS_VOCABULARY =
  "You can open content for the visitor by calling getLatestPublished to look up the latest article or post, then calling navigateToContent with that kind and slug.";

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
 * Section ORDER is preserved:
 *   safety → style → tone → tools-vocab → bio → persona → topics → inventory.
 * The first four are fixed (load-bearing) — safety prefix, style rules, the
 * optional tone clause, and TOOLS_VOCABULARY (the only place the system
 * prompt names `getLatestPublished` / `navigateToContent`). The rest are
 * truncatable.
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
  contentInventory?: ContentInventory | null;
}): string {
  // Bound name up front so a pathologically long value cannot force the
  // final backstop slice to cut into SAFETY_PREFIX or the tone clause.
  const rawName = opts.name || "this person";
  const name =
    rawName.length > MAX_NAME_CHARS ? rawName.slice(0, MAX_NAME_CHARS) : rawName;

  // Fixed (non-truncatable) sections — always preserved verbatim.
  // Order: safety → style → tone(optional) → tools-vocab. Style rules are
  // product-wide (the chat UI renders plain text, not markdown), so they
  // apply regardless of tone preset or persona prompt. TOOLS_VOCABULARY is
  // load-bearing too — it is the only place the system prompt names
  // `getLatestPublished` / `navigateToContent`, so under budget pressure
  // (verbose persona + bio + topics) it must not be proportionally shrunk
  // away. The verb names are identical across users — the per-request
  // factory only binds `profileOwnerId`, never tool args — so the line is
  // a constant, not user-derived content.
  const fixed: Array<string> = [SAFETY_PREFIX(name), STYLE_RULES];
  if (opts.tonePreset && opts.tonePreset in TONE_PRESETS) {
    fixed.push(TONE_PRESETS[opts.tonePreset].clause);
  }
  fixed.push(TOOLS_VOCABULARY);

  // Truncatable sections — bio, persona, topics, inventory. Order:
  // safety → style → tone → tools-vocab → bio → persona → topics → inventory.
  // The inventory sentence is appended last so it does not destabilize
  // existing prompt ordering for users without structured content; it is
  // genuinely user-derived (depends on which kinds the owner has populated)
  // and may legitimately compress if context budget runs tight.
  const truncatable: Array<string> = [];
  if (opts.bio) {
    truncatable.push(`Bio: ${opts.bio}`);
  }
  truncatable.push(opts.personaPrompt || DEFAULT_PERSONA);
  if (opts.topicsToAvoid) {
    truncatable.push(`Avoid discussing: ${opts.topicsToAvoid}`);
  }
  if (opts.contentInventory) {
    const inventorySentence = buildContentInventorySentence(
      opts.contentInventory,
    );
    if (inventorySentence) {
      truncatable.push(inventorySentence);
    }
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

    // Inventory of structured content the profile owner has populated.
    // Each query is a `take(1)` against an index for a presence check.
    // Articles and posts use the compound `by_userId_and_status` index so the
    // scan is bounded to published rows only — `.filter()` is forbidden by
    // `.claude/rules/convex.md` because Convex applies it AFTER the index
    // scan, meaning N drafts before any published row would read N documents.
    // Drafts are not retrieval-eligible (see
    // `embeddings/getContentForEmbedding`) and must not be mentioned in the
    // prompt. Bio entries have no draft lifecycle, so any row counts and the
    // simpler `by_userId` index is sufficient.
    const articleRow = await ctx.db
      .query("articles")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", profileOwnerId).eq("status", "published"),
      )
      .take(1);
    const postRow = await ctx.db
      .query("posts")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", profileOwnerId).eq("status", "published"),
      )
      .take(1);
    const bioEntryRow = await ctx.db
      .query("bioEntries")
      .withIndex("by_userId", (q) => q.eq("userId", profileOwnerId))
      .take(1);

    const contentInventory: ContentInventory = {
      articles: articleRow.length > 0,
      posts: postRow.length > 0,
      bioEntries: bioEntryRow.length > 0,
    };

    return {
      threadId: conversation.threadId,
      systemPrompt: composeSystemPrompt({
        name: profileOwner.name,
        bio: profileOwner.bio,
        personaPrompt: profileOwner.personaPrompt,
        tonePreset: profileOwner.tonePreset as TonePreset | null | undefined,
        topicsToAvoid: profileOwner.topicsToAvoid,
        contentInventory,
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
