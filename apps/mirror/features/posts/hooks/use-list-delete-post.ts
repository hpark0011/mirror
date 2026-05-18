/**
 * @deprecated Use `useDeletePost({ username })` (no `postId`) from
 * `./use-delete-post` directly. This re-export exists only to avoid
 * breaking any stale imports during the FG_252 consolidation wave.
 */
export { useDeletePost as useListDeletePost } from "./use-delete-post";
export type { UseDeletePostListReturn as UseListDeletePostReturn } from "./use-delete-post";
