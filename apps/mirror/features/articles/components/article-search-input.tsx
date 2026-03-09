"use client";

import { ContentListSearchInput } from "@/features/content";

type ArticleSearchInputProps = {
  query: string;
  onQueryChange: (q: string) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export function ArticleSearchInput({
  query,
  onQueryChange,
  isOpen,
  onOpen,
  onClose,
}: ArticleSearchInputProps) {
  return (
    <ContentListSearchInput
      query={query}
      onQueryChange={onQueryChange}
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      ariaLabel="Search articles"
    />
  );
}
