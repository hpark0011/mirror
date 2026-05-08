"use client";

// Bound-to-server form for `/articles/[slug]/edit`. Initial state seeded
// from the article preload; Save dispatches a `update` mutation patch with
// only the fields that diverge from the server snapshot. URL stays on the
// same slug because slug renames are intentionally explicit (the user has
// to type a new slug + Save).
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
import { useArticleCoverImageUpload } from "./use-article-cover-image-upload";
import { useArticleInlineImageUpload } from "./use-article-inline-image-upload";
import {
  articleMetadataSchema,
  type ArticleMetadataFormData,
  type ArticleStatus,
} from "../lib/schemas/article-metadata.schema";
import { type ArticleWithBody } from "../types";

interface UseEditArticleFormOptions {
  username: string;
  initial: ArticleWithBody;
}

export function useEditArticleForm({
  username,
  initial,
}: UseEditArticleFormOptions) {
  const router = useRouter();
  const update = useMutation(api.articles.mutations.update);
  const { upload: uploadCover } = useArticleCoverImageUpload();
  const { upload: uploadInlineImage } = useArticleInlineImageUpload();

  const form = useForm<ArticleMetadataFormData>({
    resolver: zodResolver(articleMetadataSchema),
    defaultValues: {
      title: initial.title,
      slug: initial.slug,
      category: initial.category,
      status: initial.status,
    },
  });

  const [body, setBody] = useState<JSONContent>(initial.body as JSONContent);
  // The query intentionally returns `coverImageUrl` only — the server-side
  // `_storage` ID is not exposed. Until the user uploads a new cover, we
  // keep `coverImageStorageId` null and OMIT the field from the patch so
  // the existing storage reference stays untouched.
  const [coverImageStorageId, setCoverImageStorageId] = useState<
    Id<"_storage"> | null
  >(null);
  const [coverImageThumbhash, setCoverImageThumbhash] = useState(
    initial.coverImageThumbhash ?? "",
  );
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    initial.coverImageUrl ?? null,
  );
  // True when the user clicked Remove on the existing cover. Distinct
  // from "no change" (`coverImageStorageId === null` on mount) — without
  // this flag the patch payload omits the field and the server cover
  // never clears. Reset on a successful save and on a fresh upload.
  const [isCoverCleared, setIsCoverCleared] = useState(false);
  const [publishedAt, setPublishedAt] = useState<number | null>(
    initial.publishedAt ?? null,
  );
  const [hasPendingUploads, setHasPendingUploads] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // FG_132: track the active blob URL so we can revoke it before assigning a
  // new one (replace/clear) and on unmount. Server URLs (not blob:) are not
  // revoked.
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
      // A fresh upload supersedes any prior clear in the same session.
      setIsCoverCleared(false);
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
    setIsCoverCleared(true);
  }, []);

  const persistValidated = useCallback(
    async (data: ArticleMetadataFormData, targetStatus: ArticleStatus) => {
      await update({
        id: initial._id,
        title: data.title.trim(),
        slug: data.slug?.trim() ? data.slug : undefined,
        category: data.category.trim(),
        body,
        status: targetStatus,
        // Send the storage ID only when the user uploaded a new cover in
        // this session. Omit (undefined) means "no change". An explicit
        // clear travels through `clearCoverImage: true` instead.
        coverImageStorageId:
          coverImageStorageId !== null ? coverImageStorageId : undefined,
        clearCoverImage: isCoverCleared ? true : undefined,
        ...(coverImageThumbhash && { coverImageThumbhash }),
      });
      // Optimistically reflect the server-side publish/unpublish timestamp
      // change so the UI doesn't wait for the next reactive query tick.
      // The optimistic re-set runs on every publish transition (not just the
      // first) so a draft → publish → draft → publish flow shows the new
      // publish time immediately, not the stale first-publish time.
      if (targetStatus === "published") {
        setPublishedAt(Date.now());
      } else {
        setPublishedAt(null);
      }
      // After a successful save, the next reactive `getBySlug` tick
      // reflects the cleared cover; reset the flag so subsequent saves
      // don't re-clear an already-empty field.
      if (isCoverCleared) {
        setIsCoverCleared(false);
      }
      // FG_153: navigate to the read view after save. The post editor
      // (`features/content/components/content-editor.tsx`) does the same via
      // `router.push(cancelHref)` on its onSave path; the article-editor
      // refactor (b0aa3cf3) split off into its own shell and silently dropped
      // the navigation, leaving users on `/edit` after Save with only a
      // `router.refresh()`. The inline-image-paste / drop / replace /
      // cascade-delete e2e specs all assert this navigation as the
      // observable end-state of save (the only way to confirm the saved body
      // round-trips back through the read view), so without it AC #1-#4 here
      // and AC #5 (post mirror) cannot be exercised end-to-end. Use the
      // post-save slug — `slug` reflects the user's edited value, which is
      // what the server normalized and persisted.
      const targetSlug = data.slug?.trim() ? data.slug.trim() : initial.slug;
      router.push(`/@${username}/articles/${targetSlug}`);
    },
    [
      body,
      coverImageStorageId,
      coverImageThumbhash,
      initial._id,
      initial.slug,
      isCoverCleared,
      router,
      update,
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
          () => resolve(), // validation failed — form errors displayed by form state
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

  const cancel = useCallback(() => {
    router.push(`/@${username}/articles/${initial.slug}`);
  }, [initial.slug, router, username]);

  const onInlineImageError = useCallback(
    (err: unknown) => {
      showToast({ type: "error", title: getMutationErrorMessage(err) });
    },
    [],
  );

  // Status is surfaced separately because the toolbar's publish-toggle button
  // reads it outside the metadata-header's RHF tree.
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
    createdAt: initial.createdAt,
    publishedAt,
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
    cancel,
  };
}
