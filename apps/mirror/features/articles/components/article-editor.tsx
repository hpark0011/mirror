"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { RichTextEditor } from "@feel-good/features/editor";
import {
  type JSONContent,
} from "@feel-good/features/editor/types";
import { api } from "@feel-good/convex/convex/_generated/api";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Toast,
  ToastIcon,
  ToastHeader,
  ToastTitle,
  ToastClose,
} from "@feel-good/ui/components/toast";
import { OctagonXIcon } from "lucide-react";
import { useArticleInlineImageUpload } from "../hooks/use-article-inline-image-upload";
import type { ArticleWithBody } from "../types";

type ArticleEditorProps = {
  article: ArticleWithBody;
  username: string;
  slug: string;
};

export function ArticleEditor({ article, username, slug }: ArticleEditorProps) {
  const router = useRouter();
  const update = useMutation(api.articles.mutations.update);
  const { upload } = useArticleInlineImageUpload();

  // Track body in state (not a ref) so the Save button always reads the
  // latest value the editor produced via `onChange`.
  const [body, setBody] = useState<JSONContent>(article.body);
  const [isSaving, setIsSaving] = useState(false);

  const readViewHref = `/@${username}/articles/${slug}`;

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await update({ id: article._id, body });
      router.push(readViewHref);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
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
    } finally {
      setIsSaving(false);
    }
  }, [article._id, body, isSaving, readViewHref, router, update]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <h1 className="truncate text-sm font-medium text-foreground">
          {article.title}
        </h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={readViewHref}>Cancel</Link>
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="save-article-btn"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-6 py-4">
        <RichTextEditor
          content={body}
          onChange={setBody}
          onImageUpload={upload}
          className="min-h-full"
        />
      </div>
    </div>
  );
}
