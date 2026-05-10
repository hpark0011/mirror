import { describe, expect, it } from "bun:test";
import { currentProfileReturnValidator } from "../helpers";
import { TONE_PRESET_VALUES } from "../../chat/tonePresets";

/**
 * UT-10: Verifies that currentProfileReturnValidator includes the three
 * persona fields (personaPrompt, tonePreset, topicsToAvoid) so that
 * getCurrentProfile returns them to the authenticated caller.
 *
 * We test the validator's field descriptor keys because the Convex query
 * itself cannot run outside the Convex runtime. The validator is the
 * authoritative contract for what getCurrentProfile returns.
 */
describe("currentProfileReturnValidator (UT-10)", () => {
  it("includes personaPrompt in the validator schema", () => {
    const fields = currentProfileReturnValidator.fields;
    expect(Object.keys(fields)).toContain("personaPrompt");
  });

  it("includes tonePreset in the validator schema", () => {
    const fields = currentProfileReturnValidator.fields;
    expect(Object.keys(fields)).toContain("tonePreset");
  });

  it("includes topicsToAvoid in the validator schema", () => {
    const fields = currentProfileReturnValidator.fields;
    expect(Object.keys(fields)).toContain("topicsToAvoid");
  });

  it("includes all six tone preset literals in tonePreset validator", () => {
    const fields = currentProfileReturnValidator.fields;
    const serialized = JSON.stringify(fields.tonePreset);
    for (const preset of TONE_PRESET_VALUES) {
      expect(serialized).toContain(preset);
    }
  });

  it("includes core profile fields (_id, authId, email, onboardingComplete)", () => {
    const fieldKeys = Object.keys(currentProfileReturnValidator.fields);
    for (const field of [
      "_id",
      "authId",
      "email",
      "onboardingComplete",
      "defaultProfileSection",
    ]) {
      expect(fieldKeys).toContain(field);
    }
  });
});
