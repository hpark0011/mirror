"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  RichTextEditor,
  createArticleExtensions,
  type JSONContent,
  type InlineImageUploadResult,
} from "@feel-good/features/editor";
import { InlineImageValidationError } from "@/lib/inline-image-validation";
import {
  Toast,
  ToastIcon,
  ToastHeader,
  ToastTitle,
  ToastClose,
} from "@feel-good/ui/components/toast";
import { OctagonXIcon } from "lucide-react";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";
import { ContentEditorToolbar } from "./content-editor-toolbar";

type ContentEditorProps = {
  /** Editor entity title shown in the header bar. */
  title: string;
  /** Initial body content fed to Tiptap. */
  initialBody: JSONContent;
  /** Persists the latest body. Errors surface via the shared toast UI. */
  onSave: (body: JSONContent) => Promise<void>;
  /** Inline-image upload pipeline (validates → presigned URL → resolve URL). */
  onImageUpload: (file: File) => Promise<InlineImageUploadResult>;
  /** Read-view URL the Cancel link returns to and the post-save redirect. */
  cancelHref: string;
  /** Optional override for the Save button label (defaults to "Save"). */
  saveLabel?: string;
  /**
   * `data-testid` for the Save button. Both article and post e2e specs key
   * off the existing IDs (`save-article-btn`, `save-post-btn`); preserve
   * them by passing through.
   */
  saveTestId?: string;
};

/**
 * Shared write-mode editor shell extracted from `ArticleEditor` / `PostEditor`
 * (FG_107). Owns body state, dirty-tracking via local state, the save flow,
 * the FG_092 pending-uploads gate, the error toast, and the RichTextEditor
 * mount. Adapters supply entity-specific mutation/upload closures and the
 * cancel/redirect href.
 */
export function ContentEditor({
  title,
  initialBody,
  onSave,
  onImageUpload,
  cancelHref,
  saveLabel = "Save",
  saveTestId,
}: ContentEditorProps) {
  const router = useRouter();

  // Track body in state (not a ref) so the Save button always reads the
  // latest value the editor produced via `onChange`.
  const [body, setBody] = useState<JSONContent>(initialBody);
  const [isSaving, setIsSaving] = useState(false);
  // Mirrors the `inlineImageUploadPluginKey` DecorationSet emptiness — the
  // editor's `onPendingUploadsChange` callback bubbles the boolean up so we
  // can disable Save while a paste/drop upload is in flight (FG_092). A
  // save during the upload window would persist a body without the image
  // because `editor.getJSON()` does not serialize widget decorations.
  const [hasPendingUploads, setHasPendingUploads] = useState(false);

  const showErrorToast = useCallback((message: string) => {
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

  // Surface inline-image upload failures (validation OR network) as a
  // toast. Without this, a failed paste/drop just removes the placeholder
  // silently — the user might save the article thinking the image was
  // included (FG_113). `InlineImageValidationError` carries a clear,
  // actionable message; everything else gets a generic copy.
  const handleImageUploadError = useCallback(
    (err: unknown) => {
      const message =
        err instanceof InlineImageValidationError
          ? err.message
          : "Image upload failed. Please try again.";
      showErrorToast(message);
    },
    [showErrorToast],
  );

  const handleSave = useCallback(async () => {
    if (isSaving || hasPendingUploads) return;
    setIsSaving(true);
    try {
      await onSave(body);
      router.push(cancelHref);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      showErrorToast(message);
    } finally {
      setIsSaving(false);
    }
  }, [body, cancelHref, hasPendingUploads, isSaving, onSave, router, showErrorToast]);

  return (
    <>
      <WorkspaceToolbar>
        <ContentEditorToolbar
          title={title}
          cancelHref={cancelHref}
          isSaving={isSaving}
          hasPendingUploads={hasPendingUploads}
          saveLabel={saveLabel}
          saveTestId={saveTestId}
          onSave={handleSave}
        />
      </WorkspaceToolbar>
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto px-6 py-4">
          <RichTextEditor
            content={body}
            onChange={setBody}
            onImageUpload={onImageUpload}
            onImageUploadError={handleImageUploadError}
            onPendingUploadsChange={setHasPendingUploads}
            extensions={createArticleExtensions}
            className="min-h-full"
          />
        </div>
      </div>
    </>
  );
}
