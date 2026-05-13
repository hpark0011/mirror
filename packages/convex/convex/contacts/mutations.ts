import { v } from "convex/values";
import { internal } from "../_generated/api";
import { authMutation } from "../lib/auth";
import { isOwnedByUser } from "../content/helpers";
import { getAppUser } from "../users/helpers";
import { CONTACT_KIND_LABEL } from "./labels";
import { contactEntryKindValidator } from "./schema";

const MAX_VALUE_LENGTH = 2000;

// Per-kind validation at the mutation boundary. The Zod form schema in
// apps/mirror/features/contact/lib/schemas/contact-entry.schema.ts already
// enforces these client-side; this is the server-side trust boundary.
// Exported so test-fixture seeders (`auth/testHelpers.ts`) cannot bypass
// validation and plant malformed values (including prompt-injection
// payloads) that would then flow through the embedding pipeline.
export function validateValue(
  kind: "email" | "linkedin" | "instagram" | "x" | "tiktok" | "youtube",
  value: string,
): void {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("value is required");
  }
  if (trimmed.length > MAX_VALUE_LENGTH) {
    throw new Error(
      `value exceeds maximum length of ${MAX_VALUE_LENGTH} (got ${trimmed.length})`,
    );
  }
  if (kind === "email") {
    // Minimal email shape check — a server-side defense against malformed
    // values that bypassed client Zod validation. Mirrors what the Zod
    // .email() refinement enforces on the form side.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new Error("email must be a valid email address");
    }
    return;
  }
  // Social profile URLs must parse as https.
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("value must be a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("URL must use https://");
  }
}

export const create = authMutation({
  args: {
    kind: contactEntryKindValidator,
    value: v.string(),
  },
  returns: v.id("contactEntries"),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);

    validateValue(args.kind, args.value);

    // One entry per platform per user. The `by_userId_and_kind` index keeps
    // this lookup O(log n) and is the storage-layer pin for the invariant
    // surfaced through the UI as "only one per platform."
    const existing = await ctx.db
      .query("contactEntries")
      .withIndex("by_userId_and_kind", (q) =>
        q.eq("userId", appUser._id).eq("kind", args.kind),
      )
      .unique();
    if (existing) {
      throw new Error(
        `${CONTACT_KIND_LABEL[args.kind]} contact already exists. Delete the existing entry first.`,
      );
    }

    const entryId = await ctx.db.insert("contactEntries", {
      userId: appUser._id,
      kind: args.kind,
      value: args.value.trim(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.embeddings.actions.generateEmbedding,
      { sourceTable: "contactEntries" as const, sourceId: entryId },
    );

    return entryId;
  },
});

/**
 * Update is value-only. Switching kinds would violate the one-per-platform
 * invariant without re-checking the index; instead, callers should delete +
 * re-add when changing platform.
 */
export const update = authMutation({
  args: {
    id: v.id("contactEntries"),
    value: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new Error("Contact entry not found");
    }
    if (!isOwnedByUser(entry, appUser._id)) {
      throw new Error("Not authorized to update this contact entry");
    }

    validateValue(entry.kind, args.value);

    await ctx.db.patch(args.id, { value: args.value.trim() });

    await ctx.scheduler.runAfter(
      0,
      internal.embeddings.actions.generateEmbedding,
      { sourceTable: "contactEntries" as const, sourceId: args.id },
    );

    return null;
  },
});

export const remove = authMutation({
  args: {
    id: v.id("contactEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new Error("Contact entry not found");
    }
    if (!isOwnedByUser(entry, appUser._id)) {
      throw new Error("Not authorized to delete this contact entry");
    }

    await ctx.db.delete(args.id);

    await ctx.scheduler.runAfter(
      0,
      internal.embeddings.mutations.deleteBySource,
      { sourceTable: "contactEntries" as const, sourceId: args.id },
    );

    return null;
  },
});
