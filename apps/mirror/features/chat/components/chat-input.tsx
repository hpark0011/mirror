"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { Icon } from "@feel-good/ui/components/icon";
import { cn } from "@feel-good/utils/cn";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@feel-good/ui/primitives/input-group";

type ChatInputProps = {
  profileName: string;
  isResponding: boolean;
  onSend: (message: string) => void;
  sendError?: string | null;
  onClearError?: () => void;
};

export function ChatInput({
  profileName,
  isResponding,
  onSend,
  sendError,
  onClearError,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const { ref: textareaRef, resize, reset } = useAutoResizeTextarea();
  const canSend = !isResponding && message.trim().length > 0;

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!canSend) return;
    onClearError?.();
    onSend(trimmed);
    setMessage("");
    reset();
  }, [canSend, message, onClearError, onSend, reset]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(event.target.value);
      onClearError?.();
      resize();
    },
    [onClearError, resize],
  );

  return (
    <div className="px-4 pb-2.5 pt-2 mx-auto w-full max-w-lg">
      <InputGroup
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
          placeholder={t("chat.input.placeholder.clone", {
            profileName,
            defaultValue: `Message ${profileName}...`,
          })}
          disabled={isResponding}
          className="min-h-[40px] max-h-[120px] py-2.5 px-3.5 md:text-[16px] leading-[1.3]"
          rows={1}
        />
        <InputGroupAddon
          align="block-end"
          className="justify-end [&>kbd]:rounded-full px-2.5 pb-2.5"
        >
          <InputGroupButton
            type="button"
            size="icon-sm"
            variant="primary"
            className="size-8 shrink-0 rounded-full [corner-shape:superellipse(1.0)]"
            disabled={!canSend}
            onClick={handleSend}
          >
            <Icon name="ArrowUpIcon" className="size-6" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {sendError ? (
        <p className="text-xs text-destructive text-center mt-1.5 px-2">
          {sendError}
        </p>
      ) : null}

      <p className="text-[13px] text-muted-foreground text-center mt-2 px-2">
        {t("chat.input.disclaimer.clone", {
          profileName,
          defaultValue: `Conversations may be visible to ${profileName}`,
        })}
      </p>
    </div>
  );
}
