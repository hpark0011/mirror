// Shared helpers for chat-related convex-test suites.
//
// Vite's `import.meta.glob` normalizes keys to the shortest possible relative
// path from the importing file, which gives mixed prefixes when the test lives
// in a nested `__tests__/` dir. `convex-test` needs a single uniform prefix
// rooted at the `_generated/` entry, so we rewrite every key to start with
// `../../chat/...` (the `chat/` dir relative to the test file's parent's
// parent — i.e. the `convex/` root when viewed from a `chat/__tests__/` file).
export function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../chat/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../chat/" + k.slice(3);
    }
    out[k] = loader;
  }
  return out;
}
