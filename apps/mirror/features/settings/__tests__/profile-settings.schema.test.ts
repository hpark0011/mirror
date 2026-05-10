import { describe, expect, it } from "vitest";
import { profileSettingsSchema } from "@/features/settings/lib/schemas/profile-settings.schema";

describe("profileSettingsSchema", () => {
  it("accepts the supported default profile sections", () => {
    for (const defaultProfileSection of ["bio", "posts", "articles"]) {
      expect(
        profileSettingsSchema.safeParse({ defaultProfileSection }).success,
      ).toBe(true);
    }
  });

  it("rejects owner-only or unknown sections", () => {
    for (const defaultProfileSection of [
      "clone-settings",
      "settings",
      "chat",
    ]) {
      expect(
        profileSettingsSchema.safeParse({ defaultProfileSection }).success,
      ).toBe(false);
    }
  });
});
