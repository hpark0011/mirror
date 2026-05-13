import { internal } from "../_generated/api";
import { type Doc, type Id } from "../_generated/dataModel";
import { type MutationCtx } from "../_generated/server";
import { isOwnedByUser } from "../content/helpers";
import { CONTACT_KIND_LABEL } from "./labels";
import {
  CONTACT_HOSTNAME_ALLOWLIST,
  isAllowedContactHost,
  validateValue,
  type NonEmailContactKind,
} from "./hostnameAllowlist";

export {
  CONTACT_HOSTNAME_ALLOWLIST,
  isAllowedContactHost,
  validateValue,
};
export type { NonEmailContactKind };

export type ContactEntryKind = Doc<"contactEntries">["kind"];

export async function createContactEntryForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: { kind: ContactEntryKind; value: string },
): Promise<Id<"contactEntries">> {
  validateValue(args.kind, args.value);

  const existing = await ctx.db
    .query("contactEntries")
    .withIndex("by_userId_and_kind", (q) =>
      q.eq("userId", userId).eq("kind", args.kind),
    )
    .unique();
  if (existing) {
    throw new Error(
      `${CONTACT_KIND_LABEL[args.kind]} contact already exists. Delete the existing entry first.`,
    );
  }

  const entryId = await ctx.db.insert("contactEntries", {
    userId,
    kind: args.kind,
    value: args.value.trim(),
  });

  await ctx.scheduler.runAfter(
    0,
    internal.embeddings.actions.generateEmbedding,
    { sourceTable: "contactEntries" as const, sourceId: entryId },
  );

  return entryId;
}

export async function updateContactEntryForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: { id: Id<"contactEntries">; value: string },
): Promise<void> {
  const entry = await ctx.db.get(args.id);
  if (!entry) {
    throw new Error("Contact entry not found");
  }
  if (!isOwnedByUser(entry, userId)) {
    throw new Error("Not authorized to update this contact entry");
  }

  validateValue(entry.kind, args.value);

  await ctx.db.patch(args.id, { value: args.value.trim() });

  await ctx.scheduler.runAfter(
    0,
    internal.embeddings.actions.generateEmbedding,
    { sourceTable: "contactEntries" as const, sourceId: args.id },
  );
}

export async function upsertContactEntryForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: { kind: ContactEntryKind; value: string },
): Promise<"created" | "updated"> {
  validateValue(args.kind, args.value);

  const existing = await ctx.db
    .query("contactEntries")
    .withIndex("by_userId_and_kind", (q) =>
      q.eq("userId", userId).eq("kind", args.kind),
    )
    .unique();

  if (!existing) {
    await createContactEntryForUser(ctx, userId, args);
    return "created";
  }

  await ctx.db.patch(existing._id, { value: args.value.trim() });
  await ctx.scheduler.runAfter(
    0,
    internal.embeddings.actions.generateEmbedding,
    { sourceTable: "contactEntries" as const, sourceId: existing._id },
  );
  return "updated";
}

export async function removeContactEntryForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  id: Id<"contactEntries">,
): Promise<void> {
  const entry = await ctx.db.get(id);
  if (!entry) {
    throw new Error("Contact entry not found");
  }
  if (!isOwnedByUser(entry, userId)) {
    throw new Error("Not authorized to delete this contact entry");
  }

  await ctx.db.delete(id);

  await ctx.scheduler.runAfter(
    0,
    internal.embeddings.mutations.deleteBySource,
    { sourceTable: "contactEntries" as const, sourceId: id },
  );
}

export async function removeContactEntryByKindForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: ContactEntryKind,
): Promise<boolean> {
  const entry = await ctx.db
    .query("contactEntries")
    .withIndex("by_userId_and_kind", (q) =>
      q.eq("userId", userId).eq("kind", kind),
    )
    .unique();

  if (!entry) return false;
  await removeContactEntryForUser(ctx, userId, entry._id);
  return true;
}
