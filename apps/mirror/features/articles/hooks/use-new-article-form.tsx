"use client";

// Defer-create-on-first-save state machine for `/articles/new`.
//
// Holds all metadata + body in local state until the user clicks Save.
// At save time it calls `api.articles.mutations.create` and, on success,
// navigates to `/<slug>/edit` so subsequent edits use the patch flow.
// No row is written before Save — abandoning the page leaves no trace.
//
// Cleanup strategy for cover-image orphans (FG_129):
//   Upload happens before create. If create throws (e.g. slug collision),
//   the bytes are in _storage with no owning row. The catch branch calls
//   `api.articles.mutations.deleteOrphanCoverImage` which re-verifies no
//   articles row references the storageId before deleting.
import { api } from "@feel-good/convex/convex/_generated/api";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import {
  type InlineImageUploadResult,
  type JSONContent,
} from "@feel-good/features/editor";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { showToast } from "@feel-good/ui/components/toast";
import { getMutationErrorMessage } from "../../bio/utils/mutation-helpers";
import { generateSlug } from "@feel-good/convex/convex/content/slug";
import { useArticleCoverImageUpload } from "./use-article-cover-image-upload";
import { useArticleInlineImageUpload } from "./use-article-inline-image-upload";
import type { ArticleStatus } from "../lib/schemas/article-metadata.schema";

const EMPTY_BODY: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

interface UseNewArticleFormOptions {
  username: string;
}

export function useNewArticleForm({ username }: UseNewArticleFormOptions) {
  const router = useRouter();
  const create = useMutation(api.articles.mutations.create);
  const deleteOrphanCoverImage = useMutation(
    api.articles.mutations.deleteOrphanCoverImage,
  );
  const { upload: uploadCover } = useArticleCoverImageUpload();
  const { upload: uploadInlineImage } = useArticleInlineImageUpload();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<ArticleStatus>("draft");
  const [body, setBody] = useState<JSONContent>(EMPTY_BODY);
  const [coverImageStorageId, setCoverImageStorageId] =
    useState<Id<"_storage"> | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [hasPendingUploads, setHasPendingUploads] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // FG_132: track the active blob URL so we can revoke it before assigning a
  // new one (replace/clear) and on unmount.
  const blobUrlRef = useRef<string | null>(null);

  // FG_132: revoke the active blob URL on unmount to prevent memory leaks.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const handleCoverImageUpload = useCallback(
    async (file: File) => {
      const storageId = await uploadCover(file);
      const objectUrl = URL.createObjectURL(file);
      // FG_132: revoke the previous blob URL before assigning a new one.
      setCoverImageUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return objectUrl;
      });
      blobUrlRef.current = objectUrl;
      setCoverImageStorageId(storageId);
      return { storageId: storageId as string, url: objectUrl };
    },
    [uploadCover],
  );

  const handleCoverImageClear = useCallback(() => {
    // FG_132: revoke blob URL on clear.
    setCoverImageUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    blobUrlRef.current = null;
    setCoverImageStorageId(null);
  }, []);

  const persist = useCallback(
    async (targetStatus: ArticleStatus) => {
      if (!title.trim()) {
        throw new Error("Title is required");
      }
      if (!category.trim()) {
        throw new Error("Category is required");
      }
      const slugSource = slug.trim() ? slug : title;
      const finalSlug = generateSlug(slugSource);
      try {
        await create({
          title: title.trim(),
          slug: finalSlug,
          category: category.trim(),
          body,
          status: targetStatus,
          ...(coverImageStorageId ? { coverImageStorageId } : {}),
        });
      } catch (err) {
        // FG_129: If create fails after a cover was uploaded, the bytes are
        // already in _storage with no owning row. Schedule a server-side
        // orphan check that deletes the blob only if no articles row
        // references it (TOCTOU-safe: both check and delete are in one
        // mutation transaction).
        if (coverImageStorageId) {
          void deleteOrphanCoverImage({ storageId: coverImageStorageId });
        }
        throw err;
      }
      router.replace(`/@${username}/articles/${finalSlug}/edit`);
    },
    [
      body,
      category,
      coverImageStorageId,
      create,
      deleteOrphanCoverImage,
      router,
      slug,
      title,
      username,
    ],
  );

  const save = useCallback(async () => {
    if (isSaving || hasPendingUploads) return;
    setIsSaving(true);
    try {
      await persist(status);
    } catch (err) {
      showToast({ type: "error", title: getMutationErrorMessage(err) });
    } finally {
      setIsSaving(false);
    }
  }, [hasPendingUploads, isSaving, persist, status]);

  const togglePublish = useCallback(async () => {
    if (isSaving || hasPendingUploads) return;
    const nextStatus: ArticleStatus =
      status === "draft" ? "published" : "draft";
    setIsSaving(true);
    try {
      await persist(nextStatus);
      setStatus(nextStatus);
    } catch (err) {
      showToast({ type: "error", title: getMutationErrorMessage(err) });
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [hasPendingUploads, isSaving, persist, status]);

  const onInlineImageError = useCallback(
    (err: unknown) => {
      showToast({ type: "error", title: getMutationErrorMessage(err) });
    },
    [],
  );

  return {
    // Metadata getters
    title,
    slug,
    category,
    status,
    coverImageUrl,
    createdAt: null as number | null,
    publishedAt: null as number | null,
    body,
    hasPendingUploads,
    isSaving,
    // Setters
    setTitle,
    setSlug,
    setCategory,
    setBody,
    setHasPendingUploads,
    handleCoverImageUpload,
    handleCoverImageClear,
    onInlineImageUpload: uploadInlineImage as (
      file: File,
    ) => Promise<InlineImageUploadResult>,
    onInlineImageError,
    save,
    togglePublish,
  };
}
