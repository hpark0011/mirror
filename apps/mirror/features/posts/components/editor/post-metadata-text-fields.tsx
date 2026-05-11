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
import { useTranslation } from "react-i18next";
import { type PostMetadataFormData } from "../../lib/schemas/post-metadata.schema";

export interface PostMetadataTextFieldsProps {
  form: UseFormReturn<PostMetadataFormData>;
  onSlugChange: (next: string, fieldOnChange: (value: string) => void) => void;
}

export function PostMetadataTextFields({
  form,
  onSlugChange,
}: PostMetadataTextFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <FormField
        control={form.control}
        name="slug"
        render={({ field }) => (
          <FormItem className="gap-1">
            <div className="flex gap-1 items-center">
              <FormLabel className="text-[13px] text-muted-foreground w-30">
                {t("editor.slugLabel")}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  data-testid="post-slug-input"
                  placeholder={t("editor.slugPlaceholder")}
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
                {t("editor.categoryLabel")}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  data-testid="post-category-input"
                  placeholder={t("postEditor.categoryPlaceholder")}
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
