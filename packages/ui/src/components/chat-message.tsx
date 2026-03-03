import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@feel-good/ui/primitives/avatar";
import { cn } from "@feel-good/utils/cn";

const chatMessageVariants = cva("flex gap-2.5 max-w-[85%]", {
  variants: {
    variant: {
      sent: "ml-auto flex-row-reverse w-[80%] max-w-md",
      received: "mr-auto w-[80%] max-w-4xl",
    },
  },
  defaultVariants: {
    variant: "received",
  },
});

function ChatMessage({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof chatMessageVariants>) {
  return (
    <div
      data-slot="chat-message"
      data-variant={variant}
      className={cn(chatMessageVariants({ variant }), className)}
      {...props}
    />
  );
}

function ChatMessageAvatar({
  className,
  src,
  alt,
  fallback,
}: React.ComponentProps<typeof Avatar> & {
  src?: string | null;
  alt?: string;
  fallback: string;
}) {
  return (
    <Avatar
      data-slot="chat-message-avatar"
      className={cn("size-7 shrink-0 mt-1", className)}
    >
      {src && <AvatarImage src={src} alt={alt ?? ""} />}
      <AvatarFallback className="text-[10px]">{fallback}</AvatarFallback>
    </Avatar>
  );
}

function ChatMessageContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-message-content"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  );
}

const chatMessageBubbleVariants = cva(
  "rounded-[20px] px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap wrap-break-word [corner-shape:superellipse(1.15)]",
  {
    variants: {
      variant: {
        sent:
          "bg-blue-11 text-primary-foreground py-[7px] px-3 text-[14px] leading-[1.3]",
        received:
          "bg-background text-foreground text-lg leading-[1.3] border border-subtle",
      },
    },
    defaultVariants: {
      variant: "received",
    },
  },
);

function ChatMessageBubble({
  className,
  variant,
  ...props
}:
  & React.ComponentProps<"div">
  & VariantProps<typeof chatMessageBubbleVariants>) {
  return (
    <div
      data-slot="chat-message-bubble"
      className={cn(chatMessageBubbleVariants({ variant }), className)}
      {...props}
    />
  );
}

function ChatMessageLoading({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="chat-message-loading"
      className={cn("inline-flex gap-1", className)}
      {...props}
    >
      <span className="size-1 rounded-full bg-current animate-pulse" />
      <span className="size-1 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
      <span className="size-1 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
    </span>
  );
}

function ChatMessageError({
  className,
  onRetry,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  onRetry?: () => void;
}) {
  return (
    <div
      data-slot="chat-message-error"
      className={cn("flex items-center gap-1.5 px-1", className)}
      {...props}
    >
      <span className="text-xs text-destructive">
        Failed to generate response
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs text-destructive underline underline-offset-2 hover:text-destructive/80"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export {
  ChatMessage,
  ChatMessageAvatar,
  ChatMessageBubble,
  chatMessageBubbleVariants,
  ChatMessageContent,
  ChatMessageError,
  ChatMessageLoading,
  chatMessageVariants,
};
