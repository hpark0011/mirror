"use client";

import { Input } from "@feel-good/ui/primitives/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";
import { type UseFormReturn } from "react-hook-form";
import { type ArticleMetadataFormData } from "../../lib/schemas/article-metadata.schema";

export interface ArticleMetadataTextFieldsProps {
  form: UseFormReturn<ArticleMetadataFormData>;
  onSlugChange: (next: string, fieldOnChange: (value: string) => void) => void;
}

export function ArticleMetadataTextFields({
  form,
  onSlugChange,
}: ArticleMetadataTextFieldsProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="slug"
        render={({ field }) => (
          <FormItem className="gap-1">
            <div className="flex gap-1 items-center">
              <FormLabel className="text-[13px] text-muted-foreground w-30">
                Slug
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  data-testid="article-slug-input"
                  placeholder="auto-from-title"
                  variant="underline"
                  className="border-transparent"
                  size="sm"
                  onChange={(e) =>
                    onSlugChange(e.target.value, field.onChange)
                  }
                />
              </FormControl>
            </div>
            <FormMessage data-testid="article-slug-error" />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="category"
        render={({ field }) => (
          <FormItem className="gap-1">
            <div className="flex gap-1 items-center">
              <FormLabel className="text-[13px] text-muted-foreground w-30">
                Category
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  data-testid="article-category-input"
                  placeholder="e.g. Process, Inspiration"
                  variant="underline"
                  className="border-transparent"
                  size="sm"
                />
              </FormControl>
            </div>
            <FormMessage data-testid="article-category-error" />
          </FormItem>
        )}
      />
    </>
  );
}
