"use client";

import { cn } from "@feel-good/utils/cn";

import { BookFlip } from "@/components/animated-geometries/book-flip";

export function MirrorLogo({ className }: { className?: string }) {
  return (
    <div className="bg-gray-6 rounded-t-full w-fit">
      <BookFlip className={cn("size-[28px]", className)} />
    </div>
  );
}
