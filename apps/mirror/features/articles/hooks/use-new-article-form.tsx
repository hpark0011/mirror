"use client";

// Defer-create-on-first-save state machine for `/articles/new`.
//
// Holds all metadata + body in local state until the user clicks Save.
// At save time it calls `api.articles.mutations.create` and, on success,
// navigates to `/<slug>/edit` so subsequent edits use the patch flow.
// No row is written before Save — abandoning the page leaves no trace.
import { api } from "@feel-good/convex/convex/_generated/api";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import {
  type InlineImageUploadResult,
  type JSONContent,
} from "@feel-good/features/editor";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { OctagonXIcon } from "lucide-react";
import {
  Toast,
  ToastClose,
  ToastHeader,
  ToastIcon,
  ToastTitle,
} from "@feel-good/ui/components/toast";
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

  const showErrorToast = useCallback((err: unknown) => {
    const message =
      typeof err === "string"
        ? err
        : err instanceof Error
          ? err.message
          : "Something went wrong";
    toast.custom((t) => (
      <Toast id={t}>
        <ToastIcon className="text-red-9">
          <OctagonXIcon />
        </ToastIcon>
        <ToastHeader>
          <ToastTitle>{message}</ToastTitle>
        </ToastHeader>
        <ToastClose />
      </Toast>
    ));
  }, []);

  const handleCoverImageUpload = useCallback(
    async (file: File) => {
      const storageId = await uploadCover(file);
      const objectUrl = URL.createObjectURL(file);
      setCoverImageStorageId(storageId);
      setCoverImageUrl(objectUrl);
      return { storageId: storageId as string, url: objectUrl };
    },
    [uploadCover],
  );

  const handleCoverImageClear = useCallback(() => {
    setCoverImageStorageId(null);
    setCoverImageUrl(null);
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
      await create({
        title: title.trim(),
        slug: finalSlug,
        category: category.trim(),
        body,
        status: targetStatus,
        ...(coverImageStorageId ? { coverImageStorageId } : {}),
      });
      router.replace(`/@${username}/articles/${finalSlug}/edit`);
    },
    [
      body,
      category,
      coverImageStorageId,
      create,
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
      const message =
        err instanceof Error ? err.message : "Failed to save article";
      showErrorToast(message);
    } finally {
      setIsSaving(false);
    }
  }, [hasPendingUploads, isSaving, persist, showErrorToast, status]);

  const togglePublish = useCallback(async () => {
    if (isSaving || hasPendingUploads) return;
    const nextStatus: ArticleStatus =
      status === "draft" ? "published" : "draft";
    setIsSaving(true);
    try {
      await persist(nextStatus);
      setStatus(nextStatus);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save article";
      showErrorToast(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [hasPendingUploads, isSaving, persist, showErrorToast, status]);

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
    onInlineImageError: showErrorToast,
    save,
    togglePublish,
  };
}
