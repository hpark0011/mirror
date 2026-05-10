"use client";

// Bound-to-server form for `/posts/[slug]/edit`. Initial state seeded from
// the post preload; Save dispatches a `update` mutation patch with only the
// fields that diverge from the server snapshot.
//
// Mirrors `apps/mirror/features/articles/hooks/use-edit-article-form.tsx`.
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
import { getMutationErrorMessage } from "@/lib/get-mutation-error-message";
import { usePostCoverImageUpload } from "./use-post-cover-image-upload";
import {
  usePostCoverVideoUpload,
  type CoverUploadState,
} from "./use-post-cover-video-upload";
import { usePostInlineImageUpload } from "./use-post-inline-image-upload";
import {
  postMetadataSchema,
  type PostMetadataFormData,
  type PostStatus,
} from "../lib/schemas/post-metadata.schema";
import { type PostSummary } from "../types";

interface UseEditPostFormOptions {
  username: string;
  initial: PostSummary;
}

export function useEditPostForm({
  username,
  initial,
}: UseEditPostFormOptions) {
  const router = useRouter();
  const update = useMutation(api.posts.mutations.update);
  const { upload: uploadCoverImage } = usePostCoverImageUpload();
  const { upload: uploadInlineImage } = usePostInlineImageUpload();
  const [coverUploadState, setCoverUploadState] =
    useState<CoverUploadState>("idle");
  const coverUploadInFlightRef = useRef(false);
  const handleCoverVideoUploadStateChange = useCallback(
    (nextState: Extract<CoverUploadState, "preparing" | "uploading">) => {
      setCoverUploadState(nextState);
    },
    [],
  );
  const { upload: uploadCoverVideo } = usePostCoverVideoUpload({
    onStateChange: handleCoverVideoUploadStateChange,
  });

  const form = useForm<PostMetadataFormData>({
    resolver: zodResolver(postMetadataSchema),
    defaultValues: {
      title: initial.title,
      slug: initial.slug,
      category: initial.category,
      status: initial.status,
    },
  });

  const [body, setBody] = useState<JSONContent>(initial.body as JSONContent);
  // The query returns cover *URLs* only — server-side storage ids aren't
  // exposed. Until the user uploads a new cover, we keep the storage-id
  // state at `null` and OMIT those fields from the patch so the server's
  // existing references stay untouched.
  const [coverImageStorageId, setCoverImageStorageId] =
    useState<Id<"_storage"> | null>(null);
  const [coverImageThumbhash, setCoverImageThumbhash] = useState(
    initial.coverImageThumbhash ?? "",
  );
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    initial.coverImageUrl ?? null,
  );
  const [coverVideoStorageId, setCoverVideoStorageId] =
    useState<Id<"_storage"> | null>(null);
  const [coverVideoPosterStorageId, setCoverVideoPosterStorageId] =
    useState<Id<"_storage"> | null>(null);
  const [coverVideoUrl, setCoverVideoUrl] = useState<string | null>(
    initial.coverVideoUrl ?? null,
  );
  const [coverVideoPosterUrl, setCoverVideoPosterUrl] = useState<string | null>(
    initial.coverVideoPosterUrl ?? null,
  );
  // True when the user clicked Remove on the existing cover. Distinct
  // from "no change" (no local storageId set on mount) — without this
  // flag the patch payload omits the cover fields and the server cover
  // never clears. Reset after each attempted save and on a fresh upload.
  const [isCoverCleared, setIsCoverCleared] = useState(false);
  const [publishedAt, setPublishedAt] = useState<number | null>(
    initial.publishedAt ?? null,
  );
  const [hasPendingUploads, setHasPendingUploads] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const handleCoverUpload = useCallback(
    async (file: File): Promise<{ kind: "image" | "video" }> => {
      if (coverUploadInFlightRef.current) {
        throw new Error("A cover upload is already in progress");
      }

      coverUploadInFlightRef.current = true;
      const previousCoverUploadState =
        coverUploadState === "preparing" || coverUploadState === "uploading"
          ? "idle"
          : coverUploadState;
      try {
        if (file.type.startsWith("video/")) {
          setCoverUploadState("preparing");
          const { videoStorageId, posterStorageId } =
            await uploadCoverVideo(file);
          const objectUrl = URL.createObjectURL(file);
          setCoverImageUrl((prev) => {
            if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
            return null;
          });
          setCoverImageStorageId(null);
          setCoverImageThumbhash("");
          setCoverVideoUrl((prev) => {
            if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
            return objectUrl;
          });
          blobUrlRef.current = objectUrl;
          setCoverVideoPosterUrl((prev) => {
            if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
            return null;
          });
          setCoverVideoStorageId(videoStorageId);
          setCoverVideoPosterStorageId(posterStorageId);
          setIsCoverCleared(false);
          setCoverUploadState("ready");
          return { kind: "video" };
        }

        setCoverUploadState("uploading");
        const { storageId, thumbhash } = await uploadCoverImage(file);
        const objectUrl = URL.createObjectURL(file);
        setCoverVideoUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
        setCoverVideoPosterUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
        setCoverVideoStorageId(null);
        setCoverVideoPosterStorageId(null);
        setCoverImageUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return objectUrl;
        });
        blobUrlRef.current = objectUrl;
        setCoverImageStorageId(storageId);
        setCoverImageThumbhash(thumbhash);
        setIsCoverCleared(false);
        setCoverUploadState("ready");
        return { kind: "image" };
      } catch (err) {
        setCoverUploadState(previousCoverUploadState);
        throw err;
      } finally {
        coverUploadInFlightRef.current = false;
      }
    },
    [coverUploadState, uploadCoverImage, uploadCoverVideo],
  );

  const handleCoverClear = useCallback(() => {
    setCoverImageUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setCoverVideoUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setCoverVideoPosterUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    blobUrlRef.current = null;
    setCoverImageStorageId(null);
    setCoverImageThumbhash("");
    setCoverVideoStorageId(null);
    setCoverVideoPosterStorageId(null);
    setIsCoverCleared(true);
    setCoverUploadState("idle");
  }, []);

  const persistValidated = useCallback(
    async (data: PostMetadataFormData, targetStatus: PostStatus) => {
      const wasCoverCleared = isCoverCleared;
      try {
        await update({
          id: initial._id,
          title: data.title.trim(),
          slug: data.slug?.trim() ? data.slug : undefined,
          category: data.category.trim(),
          body,
          status: targetStatus,
          coverImageStorageId:
            coverImageStorageId !== null ? coverImageStorageId : undefined,
          coverVideoStorageId:
            coverVideoStorageId !== null ? coverVideoStorageId : undefined,
          coverVideoPosterStorageId:
            coverVideoPosterStorageId !== null
              ? coverVideoPosterStorageId
              : undefined,
          clearCover: wasCoverCleared ? true : undefined,
          ...(coverImageThumbhash && { coverImageThumbhash }),
        });
      } catch (err) {
        if (wasCoverCleared) {
          setIsCoverCleared(false);
        }
        throw err;
      }
      if (targetStatus === "published") {
        setPublishedAt(Date.now());
      } else {
        setPublishedAt(null);
      }
      if (wasCoverCleared) {
        setIsCoverCleared(false);
      }
      // Navigate to read view after save. Mirror articles' behaviour.
      const targetSlug = data.slug?.trim() ? data.slug.trim() : initial.slug;
      router.push(`/@${username}/posts/${targetSlug}`);
    },
    [
      body,
      coverImageStorageId,
      coverImageThumbhash,
      coverVideoStorageId,
      coverVideoPosterStorageId,
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
          () => resolve(),
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
    const nextStatus: PostStatus =
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
    router.push(`/@${username}/posts/${initial.slug}`);
  }, [initial.slug, router, username]);

  const onInlineImageError = useCallback((err: unknown) => {
    showToast({ type: "error", title: getMutationErrorMessage(err) });
  }, []);

  const status = form.watch("status");
  const errors = form.formState.errors;

  return {
    form,
    errors,
    status,
    coverImageUrl,
    coverVideoUrl,
    coverVideoPosterUrl,
    coverUploadState,
    createdAt: initial.createdAt,
    publishedAt,
    body,
    hasPendingUploads,
    isSaving,
    setTitle: (value: string) => form.setValue("title", value),
    setSlug: (value: string) =>
      form.setValue("slug", value, { shouldValidate: false }),
    setCategory: (value: string) => form.setValue("category", value),
    setBody,
    setHasPendingUploads,
    handleCoverUpload,
    handleCoverClear,
    onInlineImageUpload: uploadInlineImage as (
      file: File,
    ) => Promise<InlineImageUploadResult>,
    onInlineImageError,
    save,
    togglePublish,
    cancel,
  };
}
