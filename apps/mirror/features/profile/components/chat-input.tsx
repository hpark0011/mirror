"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";

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
  isOpen: boolean;
  profileName: string;
};

const springTransition = {
  type: "spring",
  stiffness: 200,
  damping: 15,
} as const;

export function ChatInput({ isOpen, profileName }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const { ref: textareaRef, resize, reset } = useAutoResizeTextarea();

  const handleSend = useCallback(() => {
    if (!message.trim()) return;
    setMessage("");
    reset();
  }, [message, reset]);

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
      resize();
    },
    [resize],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{
            y: 20,
            scale: 0.95,
            opacity: 0,
            transition: { duration: 0.15, ease: "easeOut" },
          }}
          transition={springTransition}
          className="w-full max-w-md relative"
        >
          <div className="w-full h-[40px] absolute left-0 -top-6 bg-linear-to-t from-background to-transparent" />
          <InputGroup
            className={cn(
              "shadow-chat-input-shadow hover:bg-chat-input-bg-hover",
              "p-0",
              "has-[[data-slot=input-group-control]:focus-visible]:border-gray-1",
              "dark:has-[[data-slot=input-group-control]:focus-visible]:border-gray-3",
              "has-[[data-slot=input-group-control]:focus-visible]:ring-1",
              "has-[[data-slot=input-group-control]:focus-visible]:ring-transparent",
              "has-[[data-slot=input-group-control]:focus-visible]:bg-white",
              "has-[[data-slot=input-group-control]:focus-visible]:bg-gray-2",
            )}
          >
            <InputGroupTextarea
              ref={textareaRef}
              value={message}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${profileName}...`}
              className={cn(
                "min-h-[40px] max-h-[120px]",
                "py-2.5 px-3.5",
                "text-[20px] md:text-[16px]",
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
              <InputGroupButton
                type="button"
                size="icon-sm"
                variant="primary"
                className={cn(
                  "size-8 shrink-0",
                  "rounded-full [corner-shape:superellipse(1.0)]",
                )}
                disabled={!message.trim()}
                onClick={handleSend}
              >
                <Icon name="ArrowUpIcon" className="size-6" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
