"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { Icon } from "@feel-good/ui/components/icon";
import { cn } from "@feel-good/utils/cn";
import {
  ALLOWED_INLINE_IMAGE_TYPES,
  ALLOWED_INLINE_IMAGE_TYPES_ATTR,
  MAX_INLINE_IMAGE_BYTES,
} from "@/lib/media-policy";
import { useProjectCoverImageUpload } from "@/features/projects/hooks/use-project-cover-image-upload";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@feel-good/ui/primitives/input-group";
import { type ChatMode } from "../types";
import { type ChatImageAttachment } from "../types";

type ChatInputProps = {
  profileName: string;
  mode: ChatMode;
  isResponding: boolean;
  onSend: (
    message: string,
    attachments?: ReadonlyArray<ChatImageAttachment>,
  ) => void;
  sendError?: string | null;
  onClearError?: () => void;
};

export function ChatInput({
  profileName,
  mode,
  isResponding,
  onSend,
  sendError,
  onClearError,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<ChatImageAttachment | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const { ref: textareaRef, resize, reset } = useAutoResizeTextarea();
  const { upload } = useProjectCoverImageUpload();
  const isConfigurationMode = mode === "configuration";
  const canSend =
    !isResponding &&
    !isUploadingAttachment &&
    (message.trim().length > 0 || attachment !== null);

  const clearAttachment = useCallback(() => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachment(null);
  }, [attachment]);

  const validateAttachment = useCallback((file: File): string | null => {
    if (!ALLOWED_INLINE_IMAGE_TYPES.has(file.type)) {
      return "Attach a PNG, JPEG, or WebP image.";
    }
    if (file.size > MAX_INLINE_IMAGE_BYTES) {
      return "Image must be 5 MB or smaller.";
    }
    return null;
  }, []);

  const handleAttachmentFile = useCallback(
    async (file: File) => {
      const validationError = validateAttachment(file);
      if (validationError) {
        setAttachmentError(validationError);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      clearAttachment();
      setAttachmentError(null);
      setIsUploadingAttachment(true);

      try {
        const result = await upload(file);
        setAttachment({
          storageId: result.storageId,
          mediaType: file.type,
          filename: file.name || undefined,
          thumbhash: result.thumbhash || undefined,
          previewUrl,
        });
      } catch (err) {
        URL.revokeObjectURL(previewUrl);
        console.error("[chat-input] image attachment upload failed", err);
        setAttachmentError("Image upload failed. Try another image.");
      } finally {
        setIsUploadingAttachment(false);
      }
    },
    [clearAttachment, upload, validateAttachment],
  );

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!canSend) return;
    onClearError?.();
    onSend(trimmed, attachment ? [attachment] : []);
    setMessage("");
    setAttachment(null);
    setAttachmentError(null);
    reset();
  }, [attachment, canSend, message, onSend, onClearError, reset]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value);
      onClearError?.();
      setAttachmentError(null);
      resize();
    },
    [resize, onClearError],
  );

  return (
    <div className="px-4 pb-2.5 pt-2 mx-auto w-full max-w-lg">
      {isConfigurationMode ? (
        <input
          ref={attachmentInputRef}
          type="file"
          accept={ALLOWED_INLINE_IMAGE_TYPES_ATTR}
          className="sr-only"
          disabled={isResponding || isUploadingAttachment}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            await handleAttachmentFile(file);
            event.target.value = "";
          }}
        />
      ) : null}

      {attachment ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border-subtle bg-background/90 p-1.5 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.previewUrl}
            alt="Attached project cover"
            className="size-12 rounded-md object-cover"
          />
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {attachment.filename ?? "Project cover"}
          </p>
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-full hover:bg-muted"
            onClick={clearAttachment}
            disabled={isResponding || isUploadingAttachment}
            aria-label="Remove attached image"
          >
            <Icon name="XmarkIcon" className="size-3.5" />
          </button>
        </div>
      ) : null}

      <InputGroup
        data-chat-attachment-uploading={
          isUploadingAttachment ? "true" : "false"
        }
        className={cn(
          "shadow-chat-input-shadow hover:bg-chat-input-bg-hover",
          "p-0",
          "has-[[data-slot=input-group-control]:focus-visible]:border-gray-1",
          "dark:has-[[data-slot=input-group-control]:focus-visible]:border-gray-3",
          "has-[[data-slot=input-group-control]:focus-visible]:ring-1",
          "has-[[data-slot=input-group-control]:focus-visible]:ring-transparent",
          "has-[[data-slot=input-group-control]:focus-visible]:bg-hover",
          "has-[[data-slot=input-group-control]:focus-visible]:bg-gray-2",
        )}
      >
        <InputGroupTextarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            isConfigurationMode
              ? t("chat.input.placeholder.configuration", { defaultValue: "Paste a resume, LinkedIn URL, or profile update..." })
              : t("chat.input.placeholder.clone", { profileName, defaultValue: `Message ${profileName}...` })
          }
          disabled={isResponding}
          className={cn(
            "min-h-[40px] max-h-[120px]",
            "py-2.5 px-3.5",
            "md:text-[16px]",
            "leading-[1.3]",
          )}
          rows={1}
        />

        <InputGroupAddon
          align="block-end"
          className={cn(
            "justify-end",
            "[&>kbd]:rounded-full",
            "px-2.5 pb-2.5",
          )}
        >
          {isConfigurationMode ? (
            <InputGroupButton
              type="button"
              size="icon-sm"
              variant="ghost"
              className="size-8 shrink-0 rounded-full"
              disabled={isResponding || isUploadingAttachment}
              onClick={() => attachmentInputRef.current?.click()}
              aria-label="Attach project cover image"
            >
              <Icon name="PaperClipIcon" className="size-4.5" />
            </InputGroupButton>
          ) : null}
          <InputGroupButton
            type="button"
            size="icon-sm"
            variant="primary"
            className={cn(
              "size-8 shrink-0",
              "rounded-full [corner-shape:superellipse(1.0)]",
            )}
            disabled={!canSend}
            onClick={handleSend}
          >
            <Icon name="ArrowUpIcon" className="size-6" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {(sendError || attachmentError) && (
        <p className="text-xs text-destructive text-center mt-1.5 px-2">
          {sendError ?? attachmentError}
        </p>
      )}

      <p className="text-[13px] text-muted-foreground text-center mt-2 px-2">
        {isConfigurationMode
          ? t("chat.input.disclaimer.configuration", { defaultValue: "Profile helper chats can update your public profile" })
          : t("chat.input.disclaimer.clone", { profileName, defaultValue: `Conversations may be visible to ${profileName}` })}
      </p>
    </div>
  );
}
