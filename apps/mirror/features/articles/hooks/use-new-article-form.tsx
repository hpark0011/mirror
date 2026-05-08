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
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import {
  type InlineImageUploadResult,
  type JSONContent,
} from "@feel-good/features/editor";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { showToast } from "@feel-good/ui/components/toast";
import { getMutationErrorMessage } from "../../bio/utils/mutation-helpers";
import { generateSlug } from "@feel-good/convex/convex/content/slug";
import { useArticleCoverImageUpload } from "./use-article-cover-image-upload";
import { useArticleInlineImageUpload } from "./use-article-inline-image-upload";
import {
  articleMetadataSchema,
  type ArticleMetadataFormData,
  type ArticleStatus,
} from "../lib/schemas/article-metadata.schema";

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

  const form = useForm<ArticleMetadataFormData>({
    resolver: zodResolver(articleMetadataSchema),
    defaultValues: {
      title: "",
      slug: "",
      category: "",
      status: "draft",
    },
  });

  const [body, setBody] = useState<JSONContent>(EMPTY_BODY);
  const [coverImageStorageId, setCoverImageStorageId] =
    useState<Id<"_storage"> | null>(null);
  const [coverImageThumbhash, setCoverImageThumbhash] = useState("");
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
      const { storageId, thumbhash } = await uploadCover(file);
      const objectUrl = URL.createObjectURL(file);
      // FG_132: revoke the previous blob URL before assigning a new one.
      setCoverImageUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return objectUrl;
      });
      blobUrlRef.current = objectUrl;
      setCoverImageStorageId(storageId);
      setCoverImageThumbhash(thumbhash);
      return { storageId: storageId as string, thumbhash, url: objectUrl };
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
    setCoverImageThumbhash("");
  }, []);

  const persistValidated = useCallback(
    async (data: ArticleMetadataFormData, targetStatus: ArticleStatus) => {
      const slugSource = data.slug?.trim() ? data.slug : data.title;
      const finalSlug = generateSlug(slugSource);
      try {
        await create({
          title: data.title.trim(),
          slug: finalSlug,
          category: data.category.trim(),
          body,
          status: targetStatus,
          ...(coverImageStorageId ? { coverImageStorageId } : {}),
          ...(coverImageThumbhash && { coverImageThumbhash }),
        });
      } catch (err) {
        // FG_129: If create fails after a cover was uploaded, the bytes are
        // already in _storage with no owning row. Schedule a server-side
        // orphan check that deletes the blob only if no articles row
        // references it (TOCTOU-safe: both check and delete are in one
        // mutation transaction).
        //
        // Clear the local cover reference too — once the orphan delete is
        // enqueued, the storageId may already be gone by the time the user
        // retries, and a retry that resends it would write a dangling
        // reference. Forcing a re-upload on retry keeps the storage state
        // consistent.
        if (coverImageStorageId) {
          void deleteOrphanCoverImage({ storageId: coverImageStorageId });
          handleCoverImageClear();
        }
        throw err;
      }
      router.replace(`/@${username}/articles/${finalSlug}/edit`);
    },
    [
      body,
      coverImageStorageId,
      coverImageThumbhash,
      create,
      deleteOrphanCoverImage,
      handleCoverImageClear,
      router,
      username,
    ],
  );

  const save = useCallback(async () => {
    if (isSaving || hasPendingUploads) return;
    const currentStatus = form.getValues("status");
    setIsSaving(true);
    try {
      await new Promise<void>((resolve, reject) => {
        void form.handleSubmit(
          async (data) => {
            try {
              await persistValidated(data, currentStatus);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          () => resolve(), // validation failed — silently resolve (form errors displayed by form state)
        )();
      });
    } catch (err) {
      showToast({ type: "error", title: getMutationErrorMessage(err) });
    } finally {
      setIsSaving(false);
    }
  }, [form, hasPendingUploads, isSaving, persistValidated]);

  const togglePublish = useCallback(async () => {
    if (isSaving || hasPendingUploads) return;
    const nextStatus: ArticleStatus =
      form.getValues("status") === "draft" ? "published" : "draft";
    setIsSaving(true);
    try {
      await new Promise<void>((resolve, reject) => {
        void form.handleSubmit(
          async (data) => {
            try {
              await persistValidated(data, nextStatus);
              form.setValue("status", nextStatus, { shouldValidate: false });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          // Reject (not resolve) on validation failure so the publish
          // confirmation dialog stays open instead of silently closing
          // on a no-op publish. Inline form errors render via
          // <FormMessage />; the toast in the catch tells the user why.
          () =>
            reject(
              new Error("Please fix the highlighted fields before publishing."),
            ),
        )();
      });
    } catch (err) {
      showToast({ type: "error", title: getMutationErrorMessage(err) });
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [form, hasPendingUploads, isSaving, persistValidated]);

  const onInlineImageError = useCallback(
    (err: unknown) => {
      showToast({ type: "error", title: getMutationErrorMessage(err) });
    },
    [],
  );

  // Derive watched values for consumers that need reactive reads. Status is
  // surfaced separately because the toolbar's publish-toggle button reads it
  // outside the metadata-header's RHF tree.
  const status = form.watch("status");

  // Read formState.errors here so RHF registers a subscription on this hook —
  // that's what makes the hook re-render when validation fails. Without this
  // read, `form.formState.errors` returned via `form` stays empty in callers
  // that don't themselves access the proxy (notably `renderHook` unit tests
  // that don't mount the header). The metadata header has its own subscription
  // via `<FormField>` / `<FormMessage>`, so this is purely the headless-caller
  // anchor.
  const errors = form.formState.errors;

  return {
    // The RHF form instance. The metadata header binds to it directly via
    // `<Form>` + `<FormField>`, which is what surfaces validation errors as
    // `<FormMessage />`. Callers needing read access use `form.watch(...)`.
    form,
    errors,
    status,
    coverImageUrl,
    createdAt: null as number | null,
    publishedAt: null as number | null,
    body,
    hasPendingUploads,
    isSaving,
    // Test-only convenience setters — production callers drive RHF directly.
    setTitle: (value: string) => form.setValue("title", value),
    setSlug: (value: string) =>
      form.setValue("slug", value, { shouldValidate: false }),
    setCategory: (value: string) => form.setValue("category", value),
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
