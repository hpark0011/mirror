import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { embeddingSourceTableValidator } from "../embeddings/schema";

export type ConvexTestModules = Record<string, () => Promise<unknown>>;

type EmbeddingMode = "noop" | "real";

type NormalizeConvexTestModulesOptions = {
  sourceDir: string;
  embeddings?: EmbeddingMode;
};

function noopEmbeddingActionsModule() {
  return {
    generateEmbedding: internalAction({
      args: {
        sourceTable: embeddingSourceTableValidator,
        sourceId: v.string(),
      },
      returns: v.null(),
      handler: async () => null,
    }),
    backfillEmbeddings: internalAction({
      args: {},
      returns: v.null(),
      handler: async () => null,
    }),
  };
}

function noopEmbeddingMutationsModule() {
  return {
    // `convex-test` can print rollback noise for scheduled mutations that run
    // immediately after a test mutation commits. The production function is a
    // mutation; this test-only shim is an action so CRUD tests can schedule the
    // same function path without exercising the scheduled-mutation harness.
    deleteBySource: internalAction({
      args: {
        sourceTable: embeddingSourceTableValidator,
        sourceId: v.string(),
      },
      returns: v.null(),
      handler: async () => null,
    }),
    insertChunks: internalMutation({
      args: {
        chunks: v.array(v.any()),
      },
      returns: v.null(),
      handler: async () => null,
    }),
  };
}

function normalizeNestedTestPath(key: string, sourceDir: string): string {
  if (key.startsWith("./")) {
    return `../../${sourceDir}/__tests__/${key.slice(2)}`;
  }
  if (key.startsWith("../") && !key.startsWith("../../")) {
    return `../../${sourceDir}/${key.slice(3)}`;
  }
  return key;
}

// Shared module-map normalizer for convex-test suites under
// `convex/<sourceDir>/__tests__`.
//
// By default, scheduled embedding jobs are replaced with no-op Convex
// functions. CRUD/tool tests should assert their own write behavior without
// accidentally running the RAG embedding pipeline through `runAfter(0)`.
// Suites that assert `contentEmbeddings` behavior must pass
// `{ embeddings: "real" }`.
export function normalizeConvexTestModules(
  raw: ConvexTestModules,
  { sourceDir, embeddings = "noop" }: NormalizeConvexTestModulesOptions,
): ConvexTestModules {
  const out: ConvexTestModules = {};
  for (const [key, loader] of Object.entries(raw)) {
    out[normalizeNestedTestPath(key, sourceDir)] = loader;
  }

  if (embeddings === "noop") {
    out["../../embeddings/actions.ts"] = async () =>
      noopEmbeddingActionsModule();
    out["../../embeddings/mutations.ts"] = async () =>
      noopEmbeddingMutationsModule();
  }

  return out;
}
