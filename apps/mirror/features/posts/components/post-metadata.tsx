import { formatLongDate } from "@/features/content";
import { cn } from "@feel-good/utils/cn";
import type { PostSummary } from "../types";

type PostMetadataProps = {
  post: Pick<PostSummary, "status" | "publishedAt" | "createdAt" | "category">;
  className?: string;
  capitalizeCategory?: boolean;
};

export function PostMetadata({
  post,
  className,
  capitalizeCategory,
}: PostMetadataProps) {
  const label = post.status === "draft"
    ? "Draft"
    : formatLongDate(post.publishedAt ?? post.createdAt);

  return (
    <div
      className={cn(
        "flex flex-col items-start gap-0.5 text-nowrap",
        className,
      )}
    >
      <span className="text-[13px] leading-[1.2] uppercase font-medium">
        {label}
      </span>
      <span
        className={cn(
          "text-[14px] leading-[1.2]",
          capitalizeCategory && "capitalize",
        )}
      >
        {post.category}
      </span>
    </div>
  );
}
