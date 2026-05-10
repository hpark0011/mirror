import { z } from "zod";
import { DEFAULT_PROFILE_SECTION_VALUES } from "@feel-good/convex/convex/content/href";

export const defaultProfileSectionSchema = z.enum(
  DEFAULT_PROFILE_SECTION_VALUES,
);

export const profileSettingsSchema = z.object({
  defaultProfileSection: defaultProfileSectionSchema,
});

export type ProfileSettingsFormValues = z.infer<typeof profileSettingsSchema>;
