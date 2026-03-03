"use client";

import { useFormContext } from "react-hook-form";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

import { cn } from "@feel-good/utils/cn";
import { Input } from "@feel-good/ui/primitives/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";

import { useIsProfileOwner } from "../context/profile-context";
import {
  EDIT_SHADOW_DARK,
  EDIT_SHADOW_LIGHT,
  VIEW_SHADOW_DARK,
  VIEW_SHADOW_LIGHT,
} from "../lib/edit-shadows";

type EditableNameProps = {
  isEditing: boolean;
  name: string;
};

export function EditableName({ isEditing, name }: EditableNameProps) {
  const isOwner = useIsProfileOwner();
  const { control } = useFormContext();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const editShadow = isDark ? EDIT_SHADOW_DARK : EDIT_SHADOW_LIGHT;
  const viewShadow = isDark ? VIEW_SHADOW_DARK : VIEW_SHADOW_LIGHT;

  if (!isEditing && !name && !isOwner) return null;

  return (
    <div className="text-3xl font-medium text-center w-full max-w-md">
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem className="gap-1.5">
            <FormLabel>
              <motion.div
                className={cn(
                  "px-1 text-muted-foreground",
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: isEditing ? "100%" : "0%" }}
                transition={{ type: "spring", stiffness: 300, damping: 40 }}
              >
                Name
              </motion.div>
            </FormLabel>
            <FormControl>
              <motion.div
                className="rounded-xl [corner-shape:superellipse(1.1)]"
                initial={{
                  boxShadow: viewShadow,
                  backgroundColor: "rgba(255,255,255,0)",
                }}
                animate={{
                  boxShadow: isEditing ? editShadow : viewShadow,
                  backgroundColor: isEditing
                    ? isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(255,255,255,0.6)"
                    : "rgba(255,255,255,0)",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 40 }}
              >
                <Input
                  placeholder="Your name"
                  readOnly={!isEditing}
                  tabIndex={isEditing ? undefined : -1}
                  className={cn(
                    "text-3xl md:text-3xl font-[580] text-center h-13 bg-transparent rounded-xl focus-visible:border-transparent focus-visible:bg-gray-1 p-1 border-transparent [text-shadow:0px_1px_2px_rgba(0,0,0,0.2)] focus-visible:ring-0 placeholder:text-gray-11 dark:bg-transparent uppercase",
                    !isEditing &&
                      "border-transparent focus-visible:ring-0 pointer-events-none  hover:bg-transparent hover:border-transparent [text-shadow:0px_0px_0px_rgba(0,0,0,0.2)]",
                  )}
                  data-test="edit-profile-name-input"
                  {...field}
                />
              </motion.div>
            </FormControl>
            {isEditing && <FormMessage />}
          </FormItem>
        )}
      />
    </div>
  );
}
