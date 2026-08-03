import { migrations } from "../migrations";

export function clearedUserCustomizationFields() {
  return {
    personaPrompt: undefined,
    tonePreset: undefined,
    topicsToAvoid: undefined,
    chatAuthRequired: undefined,
    defaultProfileSection: undefined,
  } as const;
}

/**
 * Release A only. Remove this definition after every deployment reports the
 * migration complete and before narrowing the users schema in Release B.
 */
export const clearUserCustomization = migrations.define({
  table: "users",
  migrateOne: clearedUserCustomizationFields,
});

/**
 * Release A only. Run after all legacy configuration conversations have been
 * deleted with their agent threads. Missing-mode rows are intentionally
 * untouched.
 */
export const clearLegacyCloneMode = migrations.define({
  table: "conversations",
  customRange: (query) =>
    query.withIndex("by_mode", (q) => q.eq("mode", "clone")),
  migrateOne: () => ({ mode: undefined }),
});
