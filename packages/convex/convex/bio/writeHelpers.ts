import { type Doc, type Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { type MutationCtx } from "../_generated/server";
import { isOwnedByUser } from "../content/helpers";

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_LINK_LENGTH = 2000;
export const MAX_BIO_ENTRIES_PER_USER = 50;

type BioPatch = Partial<
  Omit<Doc<"bioEntries">, "_id" | "_creationTime" | "userId">
>;

type BioEntryKind = Doc<"bioEntries">["kind"];

export type CreateBioEntryArgs = {
  kind: BioEntryKind;
  title: string;
  startDate: number;
  endDate: number | null;
  description?: string;
  link?: string;
};

export type UpdateBioEntryArgs = {
  id: Id<"bioEntries">;
  kind?: BioEntryKind;
  title?: string;
  startDate?: number;
  endDate?: number | null;
  description?: string;
  link?: string;
};

function validateString(value: string, field: string, maxLength: number): void {
  if (value.length > maxLength) {
    throw new Error(
      `${field} exceeds maximum length of ${maxLength} (got ${value.length})`,
    );
  }
}

function validateDateRange(startDate: number, endDate: number | null): void {
  if (endDate !== null && endDate < startDate) {
    throw new Error("endDate must be greater than or equal to startDate");
  }
}

export async function createBioEntryForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: CreateBioEntryArgs,
): Promise<Id<"bioEntries">> {
  if (args.title.trim().length === 0) {
    throw new Error("title is required");
  }
  validateString(args.title, "title", MAX_TITLE_LENGTH);
  if (args.description !== undefined) {
    validateString(args.description, "description", MAX_DESCRIPTION_LENGTH);
  }
  if (args.link !== undefined) {
    validateString(args.link, "link", MAX_LINK_LENGTH);
  }
  validateDateRange(args.startDate, args.endDate);

  const existingCount = await ctx.db
    .query("bioEntries")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  if (existingCount.length >= MAX_BIO_ENTRIES_PER_USER) {
    throw new Error(
      `Bio entry limit reached (${MAX_BIO_ENTRIES_PER_USER}). Please remove an existing entry first.`,
    );
  }

  const entryId = await ctx.db.insert("bioEntries", {
    userId,
    kind: args.kind,
    title: args.title,
    startDate: args.startDate,
    endDate: args.endDate,
    description: args.description,
    link: args.link,
  });

  await ctx.scheduler.runAfter(
    0,
    internal.embeddings.actions.generateEmbedding,
    { sourceTable: "bioEntries" as const, sourceId: entryId },
  );

  return entryId;
}

export async function updateBioEntryForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: UpdateBioEntryArgs,
): Promise<void> {
  const entry = await ctx.db.get(args.id);
  if (!entry) {
    throw new Error("Bio entry not found");
  }
  if (!isOwnedByUser(entry, userId)) {
    throw new Error("Not authorized to update this bio entry");
  }

  if (args.title !== undefined) {
    if (args.title.trim().length === 0) {
      throw new Error("title is required");
    }
    validateString(args.title, "title", MAX_TITLE_LENGTH);
  }
  if (args.description !== undefined) {
    validateString(args.description, "description", MAX_DESCRIPTION_LENGTH);
  }
  if (args.link !== undefined) {
    validateString(args.link, "link", MAX_LINK_LENGTH);
  }

  const nextStart = args.startDate ?? entry.startDate;
  const nextEnd = args.endDate !== undefined ? args.endDate : entry.endDate;
  validateDateRange(nextStart, nextEnd);

  const patch: BioPatch = {};
  if (args.kind !== undefined) patch.kind = args.kind;
  if (args.title !== undefined) patch.title = args.title;
  if (args.startDate !== undefined) patch.startDate = args.startDate;
  if (args.endDate !== undefined) patch.endDate = args.endDate;
  if (args.description !== undefined) patch.description = args.description;
  if (args.link !== undefined) patch.link = args.link;

  await ctx.db.patch(args.id, patch);

  await ctx.scheduler.runAfter(
    0,
    internal.embeddings.actions.generateEmbedding,
    { sourceTable: "bioEntries" as const, sourceId: args.id },
  );
}

export async function removeBioEntryForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  id: Id<"bioEntries">,
): Promise<void> {
  const entry = await ctx.db.get(id);
  if (!entry) {
    throw new Error("Bio entry not found");
  }
  if (!isOwnedByUser(entry, userId)) {
    throw new Error("Not authorized to delete this bio entry");
  }

  await ctx.db.delete(id);

  await ctx.scheduler.runAfter(
    0,
    internal.embeddings.mutations.deleteBySource,
    { sourceTable: "bioEntries" as const, sourceId: id },
  );
}
