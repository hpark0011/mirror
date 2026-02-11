"use client";

import { ThemeToggleButton } from "@feel-good/features/theme/components";
import { Icon } from "@feel-good/ui/components/icon";
import { cn } from "@feel-good/utils/cn";
import Link from "next/link";

type ProfileHeaderProps = {
  username: string;
  isArticleDetail: boolean;
  className?: string;
};

export function ProfileHeader({
  username,
  isArticleDetail,
  className,
}: ProfileHeaderProps) {
  return (
    <header
      className={cn(
        "z-10 flex h-10 items-center gap-2 px-4 bg-linear-to-b from-background via-background/70 to-transparent",
        isArticleDetail ? "justify-between" : "justify-end",
        className,
      )}
    >
      {isArticleDetail && (
        <Link
          href={`/@${username}`}
          className="flex items-center gap-0.5 text-[14px] text-muted-foreground hover:text-foreground  group"
        >
          <Icon
            name="ArrowLeftCircleFillIcon"
            className="size-6 text-icon group-hover:text-foreground"
          />
          <span className="leading-[1.2]">Back</span>
        </Link>
      )}
      <ThemeToggleButton />
    </header>
  );
}
