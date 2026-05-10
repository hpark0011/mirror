import {
  normalizeConvexTestModules,
  type ConvexTestModules,
} from "../../__tests__/testUtils";

// Shared helpers for chat-related convex-test suites. Defaults to no-op
// scheduled embeddings; pass `{ embeddings: "real" }` for RAG tests that
// assert `contentEmbeddings` rows.
export function normalizeConvexGlob(
  raw: ConvexTestModules,
  options?: { embeddings?: "noop" | "real" },
): ConvexTestModules {
  return normalizeConvexTestModules(raw, {
    sourceDir: "chat",
    embeddings: options?.embeddings,
  });
}
