"use client";

import { useFormContext } from "react-hook-form";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

import { cn } from "@feel-good/utils/cn";
import { Textarea } from "@feel-good/ui/primitives/textarea";
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

const springTransition = {
  type: "spring",
  stiffness: 300,
  damping: 40,
} as const;

type EditableBioProps = {
  isEditing: boolean;
  bio: string;
};

export function EditableBio({ isEditing, bio }: EditableBioProps) {
  const isOwner = useIsProfileOwner();
  const { control, watch } = useFormContext();
  const bioValue = watch("bio");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const editShadow = isDark ? EDIT_SHADOW_DARK : EDIT_SHADOW_LIGHT;
  const viewShadow = isDark ? VIEW_SHADOW_DARK : VIEW_SHADOW_LIGHT;

  if (!isEditing && !bio && !isOwner) return null;

  return (
    <div className="text-lg text-center max-w-md mx-auto leading-[1.3] w-full flex">
      <FormField
        control={control}
        name="bio"
        render={({ field }) => (
          <FormItem className="w-full relative">
            <FormLabel className="absolute left-0.5 top-0.5 rounded-xl text-xs">
              <motion.div
                initial={{
                  opacity: 0,
                  backgroundColor: "rgba(255,255,255,0)",
                }}
                animate={{ opacity: isEditing ? "100%" : "0%" }}
                transition={springTransition}
                className="py-[3px] text-muted-foreground text-xs px-[6px] backdrop-blur-xs rounded-xl"
              >
                Bio
              </motion.div>
            </FormLabel>
            <FormControl>
              <motion.div
                className="rounded-xl [corner-shape:superellipse(1.1)] w-full"
                initial={{ boxShadow: viewShadow }}
                animate={{
                  boxShadow: isEditing ? editShadow : viewShadow,
                  backgroundColor: isEditing
                    ? isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(255,255,255,0.6)"
                    : "rgba(255,255,255,0)",
                }}
                transition={springTransition}
              >
                <Textarea
                  placeholder="Tell your story..."
                  maxLength={300}
                  readOnly={!isEditing}
                  tabIndex={isEditing ? undefined : -1}
                  className={cn(
                    "text-lg md:text-lg text-center leading-[1.3] bg-transparent dark:bg-transparent min-h-[96px] resize-none border-transparent ring-0 shadow-transparent rounded-xl hover:bg-gray-1 focus-visible:bg-gray-1 focus-visible:border-transparent w-full [text-shadow:0px_1px_1px_rgba(0,0,0,0.1)] focus-visible:ring-0 placeholder:text-gray-11 py-3",
                    !isEditing &&
                      "border-transparent focus-visible:ring-0 pointer-events-none hover:bg-transparent hover:border-transparent [text-shadow:0px_0px_0px_rgba(0,0,0,0.2)]",
                  )}
                  data-test="edit-profile-bio-textarea"
                  {...field}
                />
              </motion.div>
            </FormControl>
            {isEditing && (
              <div className="flex items-center justify-between px-1">
                <FormMessage />
                <p className="ml-auto text-[13px] text-green-11">
                  {bioValue?.length ?? 0}/300
                </p>
              </div>
            )}
          </FormItem>
        )}
      />
    </div>
  );
}
