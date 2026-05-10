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
import { type PostMetadataFormData } from "../../lib/schemas/post-metadata.schema";

export interface PostMetadataTextFieldsProps {
  form: UseFormReturn<PostMetadataFormData>;
  onSlugChange: (next: string, fieldOnChange: (value: string) => void) => void;
}

export function PostMetadataTextFields({
  form,
  onSlugChange,
}: PostMetadataTextFieldsProps) {
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
                  data-testid="post-slug-input"
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
            <FormMessage data-testid="post-slug-error" />
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
                  data-testid="post-category-input"
                  placeholder="e.g. Notes, Updates"
                  variant="underline"
                  className="border-transparent"
                  size="sm"
                />
              </FormControl>
            </div>
            <FormMessage data-testid="post-category-error" />
          </FormItem>
        )}
      />
    </>
  );
}
