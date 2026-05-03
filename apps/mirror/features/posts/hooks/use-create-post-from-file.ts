"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAction, useMutation } from "convex/react";
import { type JSONContent } from "@feel-good/features/editor/types";
import { api } from "@feel-good/convex/convex/_generated/api";
import { usePostCoverImageUpload } from "./use-post-cover-image-upload";

type CreatePostArgs = {
  title: string;
  slug: string;
  category: string;
  body: JSONContent;
  coverImageFile?: File | null;
};

export type ImportFailure = { src: string; reason: string };

export type ImportResult = {
  imported: number;
  failed: number;
  failures: ImportFailure[];
};

export type ImportStatus = "idle" | "importing" | "done";

export type UseCreatePostFromFileReturn = {
  createPost: (args: CreatePostArgs) => Promise<void>;
  cancelImport: () => void;
  isCreating: boolean;
  error: string | null;
  importStatus: ImportStatus;
  importResult: ImportResult | null;
  reset: () => void;
};

/**
 * Markdown-import flow for posts (FR-08).
 *
 * The post is always created with `status: "draft"` so it can never be
 * published with unprocessed external image URLs (privacy / tracker-pixel
 * concern). After create, the inline-image import action runs to fetch each
 * `![](https://…)` and rewrite the body to point at Convex-served URLs.
 *
 * Action invocation policy: per-image failures are recorded into
 * `importResult.failures` and surfaced — they DO NOT throw out of
 * `createPost`. Cover-image upload errors continue to throw as before.
 * If the action ITSELF rejects (auth, ownership, transport glitch) we
 * record it as a single synthetic failure rather than rethrowing —
 * the post has already been created (in `draft`), so the user can still
 * review and manually publish without the inline rewrite.
 */
export function useCreatePostFromFile(): UseCreatePostFromFileReturn {
  const create = useMutation(api.posts.mutations.create);
  const update = useMutation(api.posts.mutations.update);
  const importMarkdownInlineImages = useAction(
    api.posts.inlineImages.importPostMarkdownInlineImages,
  );
  const { upload: uploadCoverImage } = usePostCoverImageUpload();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Cancellation guard: any setState after an `await` in `createPost` must
  // check this ref and bail out if true. The Convex action itself can't be
  // aborted (no AbortController surface yet), so we silence client-side
  // propagation when the dialog closes mid-import. The server-side import
  // is fire-and-forget at that point — the cron sweep handles orphans.
  const cancelledRef = useRef(false);

  // Set on unmount so any in-flight `createPost` whose component unmounts
  // mid-await also short-circuits its setStates. Paired with the explicit
  // `cancelImport()` for the dialog-close case where the component stays
  // mounted but logically wants the import abandoned.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setIsCreating(false);
    setImportStatus("idle");
    setImportResult(null);
  }, []);

  const cancelImport = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const createPost = useCallback(
    async (args: CreatePostArgs) => {
      // Reset the cancellation flag at the start of every createPost call.
      // Without this, a hook instance that ran one cancelled import would
      // permanently silence all subsequent imports — the dialog reopens and
      // the next confirm would silently no-op past every await.
      cancelledRef.current = false;
      setIsCreating(true);
      setError(null);
      setImportStatus("idle");
      setImportResult(null);
      try {
        // Always force draft (FR-08): a markdown-imported post must never be
        // published before its inline images are processed, regardless of any
        // front-matter directive in the source markdown.
        const postId = await create({
          title: args.title,
          slug: args.slug,
          category: args.category,
          body: args.body,
          status: "draft",
        });
        if (cancelledRef.current) return;

        // Cover-image upload still throws on failure (matches prior behavior).
        if (args.coverImageFile) {
          const coverImageStorageId = await uploadCoverImage(
            args.coverImageFile,
          );
          if (cancelledRef.current) return;
          await update({ id: postId, coverImageStorageId });
          if (cancelledRef.current) return;
        }

        // FR-08 inline-image import. Status stays `draft` either way — we
        // never bump status from this hook.
        setImportStatus("importing");
        try {
          const result = await importMarkdownInlineImages({ postId });
          if (cancelledRef.current) return;
          setImportResult(result);
        } catch (e) {
          if (cancelledRef.current) return;
          // Action-level failure (auth, ownership, transport). Don't rethrow:
          // the post exists, it's in draft, the user just won't see images
          // materialized. Record one synthetic failure entry so the dialog
          // can show what happened.
          const reason = e instanceof Error ? e.message : "unknown";
          setImportResult({
            imported: 0,
            failed: 1,
            failures: [{ src: "(action error)", reason }],
          });
        } finally {
          if (!cancelledRef.current) {
            setImportStatus("done");
          }
        }
      } catch (e) {
        if (cancelledRef.current) return;
        const message =
          e instanceof Error ? e.message : "Failed to create post";
        setError(message);
        throw e;
      } finally {
        if (!cancelledRef.current) {
          setIsCreating(false);
        }
      }
    },
    [create, importMarkdownInlineImages, update, uploadCoverImage],
  );

  return {
    createPost,
    cancelImport,
    isCreating,
    error,
    importStatus,
    importResult,
    reset,
  };
}
