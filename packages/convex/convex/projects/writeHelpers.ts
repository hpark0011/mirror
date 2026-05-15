import { internal } from "../_generated/api";
import { type Doc, type Id } from "../_generated/dataModel";
import { type MutationCtx } from "../_generated/server";
import { validateThumbhashFormat } from "../articles/helpers";
import {
  assertCoverBlobOwnership,
  deleteCoverBlobAndOwnership,
} from "../content/coverBlobOwnership";
import { isOwnedByUser } from "../content/helpers";
import { collectReferencedFromCandidates } from "../content/storageRegistry";

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_LINK_LENGTH = 2000;
export const MAX_PROJECTS_PER_USER = 50;

type ProjectPatch = Partial<
  Omit<Doc<"projects">, "_id" | "_creationTime" | "userId">
>;

type ProjectCoverCleanupOptions = {
  deferCoverBlobDeletion?: Array<Id<"_storage">>;
};

export type CreateProjectArgs = {
  title: string;
  startDate: number;
  endDate: number | null;
  description?: string;
  link?: string;
  coverImageStorageId?: Id<"_storage">;
  coverImageThumbhash?: string;
};

export type UpdateProjectArgs = {
  id: Id<"projects">;
  title?: string;
  startDate?: number;
  endDate?: number | null;
  description?: string;
  link?: string;
  coverImageStorageId?: Id<"_storage">;
  coverImageThumbhash?: string;
  clearCover?: boolean;
};

function validateString(value: string, field: string, maxLength: number): void {
  if (value.length > maxLength) {
    throw new Error(
      `${field} exceeds maximum length of ${maxLength} (got ${value.length})`,
    );
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.trim();
}

function validateDateRange(startDate: number, endDate: number | null): void {
  if (endDate !== null && endDate < startDate) {
    throw new Error("endDate must be greater than or equal to startDate");
  }
}

function validateHttpsLink(value: string | undefined): void {
  if (value === undefined) return;
  validateString(value, "link", MAX_LINK_LENGTH);
  if (value.trim().length === 0) return;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("link must be a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("link must use https://");
  }
}

function validateProjectText(args: {
  title?: string;
  description?: string;
  link?: string;
}): void {
  if (args.title !== undefined) {
    if (args.title.trim().length === 0) {
      throw new Error("title is required");
    }
    validateString(args.title, "title", MAX_TITLE_LENGTH);
  }
  if (args.description !== undefined) {
    validateString(args.description, "description", MAX_DESCRIPTION_LENGTH);
  }
  validateHttpsLink(args.link);
}

function validateCoverThumbhash(
  coverImageStorageId: Id<"_storage"> | undefined,
  coverImageThumbhash: string | undefined,
  existingCoverImageStorageId?: Id<"_storage">,
): void {
  if (coverImageThumbhash === undefined || coverImageThumbhash.trim() === "") {
    return;
  }
  if (
    coverImageStorageId === undefined &&
    existingCoverImageStorageId === undefined
  ) {
    throw new Error("coverImageThumbhash requires a cover image");
  }
  validateThumbhashFormat(coverImageThumbhash);
}

async function deleteUnreferencedProjectCoverBlobs(
  ctx: MutationCtx,
  storageIds: Iterable<Id<"_storage"> | undefined>,
): Promise<void> {
  const candidates = Array.from(
    new Set(Array.from(storageIds).filter((id) => id !== undefined)),
  );
  const referenced = await collectReferencedFromCandidates(ctx, candidates);

  for (const storageId of candidates) {
    if (!referenced.has(storageId)) {
      await deleteCoverBlobAndOwnership(ctx, storageId);
    }
  }
}

async function cleanupProjectCoverBlob(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined,
  options?: ProjectCoverCleanupOptions,
): Promise<void> {
  if (storageId === undefined) return;
  if (options?.deferCoverBlobDeletion) {
    options.deferCoverBlobDeletion.push(storageId);
    return;
  }

  await deleteUnreferencedProjectCoverBlobs(ctx, [storageId]);
}

export async function cleanupDeferredProjectCoverBlobs(
  ctx: MutationCtx,
  storageIds: Array<Id<"_storage">>,
): Promise<void> {
  await deleteUnreferencedProjectCoverBlobs(ctx, storageIds);
}

export async function createProjectForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: CreateProjectArgs,
): Promise<Id<"projects">> {
  validateProjectText(args);
  validateDateRange(args.startDate, args.endDate);
  validateCoverThumbhash(args.coverImageStorageId, args.coverImageThumbhash);

  if (args.coverImageStorageId !== undefined) {
    await assertCoverBlobOwnership(
      ctx,
      args.coverImageStorageId,
      userId,
      "image",
    );
  }

  const existing = await ctx.db
    .query("projects")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  if (existing.length >= MAX_PROJECTS_PER_USER) {
    throw new Error(
      `Project limit reached (${MAX_PROJECTS_PER_USER}). Please remove an existing project first.`,
    );
  }

  const now = Date.now();
  const projectId = await ctx.db.insert("projects", {
    userId,
    title: args.title.trim(),
    startDate: args.startDate,
    endDate: args.endDate,
    description: normalizeOptionalText(args.description),
    link: normalizeOptionalText(args.link),
    coverImageStorageId: args.coverImageStorageId,
    coverImageThumbhash: args.coverImageThumbhash?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.scheduler.runAfter(
    0,
    internal.embeddings.actions.generateEmbedding,
    { sourceTable: "projects" as const, sourceId: projectId },
  );

  return projectId;
}

export async function updateProjectForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: UpdateProjectArgs,
  options?: ProjectCoverCleanupOptions,
): Promise<void> {
  const project = await ctx.db.get(args.id);
  if (!project) {
    throw new Error("Project not found");
  }
  if (!isOwnedByUser(project, userId)) {
    throw new Error("Not authorized to update this project");
  }
  if (args.clearCover === true && args.coverImageStorageId !== undefined) {
    throw new Error("clearCover cannot be combined with coverImageStorageId");
  }

  validateProjectText(args);
  const nextStart = args.startDate ?? project.startDate;
  const nextEnd = args.endDate !== undefined ? args.endDate : project.endDate;
  validateDateRange(nextStart, nextEnd);
  validateCoverThumbhash(
    args.coverImageStorageId,
    args.coverImageThumbhash,
    project.coverImageStorageId,
  );

  if (
    args.coverImageStorageId !== undefined &&
    args.coverImageStorageId !== project.coverImageStorageId
  ) {
    await assertCoverBlobOwnership(
      ctx,
      args.coverImageStorageId,
      userId,
      "image",
    );
  }

  const patch: ProjectPatch = { updatedAt: Date.now() };
  if (args.title !== undefined) patch.title = args.title.trim();
  if (args.startDate !== undefined) patch.startDate = args.startDate;
  if (args.endDate !== undefined) patch.endDate = args.endDate;
  if (args.description !== undefined) {
    patch.description = normalizeOptionalText(args.description);
  }
  if (args.link !== undefined) patch.link = normalizeOptionalText(args.link);

  let coverToDelete: Id<"_storage"> | undefined;
  if (args.clearCover === true) {
    patch.coverImageStorageId = undefined;
    patch.coverImageThumbhash = undefined;
    coverToDelete = project.coverImageStorageId;
  } else if (args.coverImageStorageId !== undefined) {
    patch.coverImageStorageId = args.coverImageStorageId;
    patch.coverImageThumbhash = args.coverImageThumbhash?.trim() || undefined;
    if (args.coverImageStorageId !== project.coverImageStorageId) {
      coverToDelete = project.coverImageStorageId;
    }
  } else if (args.coverImageThumbhash !== undefined) {
    patch.coverImageThumbhash = args.coverImageThumbhash.trim() || undefined;
  }

  await ctx.db.patch(args.id, patch);

  await ctx.scheduler.runAfter(
    0,
    internal.embeddings.actions.generateEmbedding,
    { sourceTable: "projects" as const, sourceId: args.id },
  );

  if (coverToDelete !== undefined) {
    await cleanupProjectCoverBlob(ctx, coverToDelete, options);
  }
}

export async function removeProjectForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  id: Id<"projects">,
  options?: ProjectCoverCleanupOptions,
): Promise<void> {
  const project = await ctx.db.get(id);
  if (!project) {
    throw new Error("Project not found");
  }
  if (!isOwnedByUser(project, userId)) {
    throw new Error("Not authorized to delete this project");
  }

  await ctx.db.delete(id);

  await ctx.scheduler.runAfter(
    0,
    internal.embeddings.mutations.deleteBySource,
    { sourceTable: "projects" as const, sourceId: id },
  );

  await cleanupProjectCoverBlob(ctx, project.coverImageStorageId, options);
}
