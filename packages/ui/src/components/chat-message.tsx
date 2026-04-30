import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@feel-good/utils/cn";
import { SVGProps } from "react";

const chatMessageVariants = cva("flex gap-1 max-w-[85%] relative", {
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

type BubbleTailProps = SVGProps<SVGSVGElement> & {
  side?: "left" | "right";
  pathFill?: string;
};

function BubbleTail({
  className,
  side = "right",
  pathFill = "var(--blue-11)",
  ...props
}: BubbleTailProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "absolute -bottom-[3px]",
        side === "right" ? "right-[-2px]" : "left-[-2px] -scale-x-100",
        className,
      )}
      {...props}
    >
      <path
        d="M10.6985 11.7925C4.96337 6.86778 6.74097 2.56293 7.69502 0.1875L-0.0532227 6.00238C4.70106 11.329 8.99525 11.7925 10.6985 11.7925Z"
        fill={pathFill}
      />
    </svg>
  );
}

const chatMessageBubbleVariants = cva(
  "rounded-[20px] px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap wrap-break-word [corner-shape:superellipse(1.15)] relative text-[16px]",
  {
    variants: {
      variant: {
        sent:
          "bg-blue-11 text-primary-foreground py-[7px] px-3 leading-[1.3] text-[15px]",
        received:
          "bg-secondary text-foreground leading-[1.3] shadow-[0px_8px_16px_-8px_rgba(0,0,0,0.1)] border border-white dark:border-accent",
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
  children,
  ...props
}:
  & React.ComponentProps<"div">
  & VariantProps<typeof chatMessageBubbleVariants>) {
  const resolvedVariant = variant ?? "received";
  return (
    <div
      data-slot="chat-message-bubble"
      className={cn(
        chatMessageBubbleVariants({ variant: resolvedVariant }),
        className,
      )}
      {...props}
    >
      {children}
      {resolvedVariant === "sent" && <BubbleTail />}
      {resolvedVariant === "received" && (
        <BubbleTail
          side="left"
          pathFill="var(--secondary)"
          className="-bottom-[4px]"
        />
      )}
    </div>
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
  ChatMessageBubble,
  chatMessageBubbleVariants,
  ChatMessageContent,
  ChatMessageError,
  ChatMessageLoading,
  chatMessageVariants,
};
