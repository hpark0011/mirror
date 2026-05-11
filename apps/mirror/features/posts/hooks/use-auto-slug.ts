"use client";

// Mirror of `apps/mirror/features/articles/hooks/use-auto-slug.ts` for posts.
// Tracks whether the slug field has been manually edited so subsequent title
// changes don't overwrite the user's choice. A whitespace-only or cleared
// slug re-enables auto-derive — the trim rule matches the save path.
// Initialised from the current slug so editing the title of an existing post
// does not silently rename its URL.
import { useCallback, useRef } from "react";
import { type UseFormReturn } from "react-hook-form";
import { generateSlug } from "@feel-good/convex/convex/content/slug";
import { type PostMetadataFormData } from "../lib/schemas/post-metadata.schema";

export function useAutoSlug(form: UseFormReturn<PostMetadataFormData>) {
  const slugDirtyRef = useRef(
    (form.getValues("slug") ?? "").trim().length > 0,
  );

  const handleTitleChange = useCallback(
    (next: string, fieldOnChange: (value: string) => void) => {
      fieldOnChange(next);
      if (!slugDirtyRef.current) {
        if (next.trim().length === 0) {
          form.setValue("slug", "", { shouldValidate: false });
        } else {
          try {
            form.setValue("slug", generateSlug(next), {
              shouldValidate: false,
            });
          } catch {
            // generateSlug throws when the input has no usable chars
            // (pure punctuation). Leave slug untouched in that case.
          }
        }
      }
    },
    [form],
  );

  const handleSlugChange = useCallback(
    (next: string, fieldOnChange: (value: string) => void) => {
      slugDirtyRef.current = next.trim().length > 0;
      fieldOnChange(next);
    },
    [],
  );

  return { handleTitleChange, handleSlugChange };
}
