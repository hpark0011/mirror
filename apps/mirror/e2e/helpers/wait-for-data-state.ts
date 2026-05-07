import { type Page } from "@playwright/test";

/**
 * Wait until a `data-<feature>` attribute on the page reaches an expected
 * value. The convention is that any async UI work emits a settled state
 * (e.g. `data-cover-uploading="false"`, `data-chat-resolving="false"`)
 * once it completes; e2e tests then key off that flip rather than a
 * fixed timeout.
 *
 * Waits for DOM presence ("attached") rather than visibility, matching
 * the documented contract — the carrier element may be a hidden sentinel
 * (e.g. body-level attribute, off-screen marker) and the wait must still
 * resolve as soon as the state flips.
 *
 * See `.claude/rules/verification.md` § "Deterministic e2e waits" for the
 * full convention and the rationale.
 */
export async function waitForDataState(
  page: Page,
  feature: string,
  expected: string,
  options: { timeout?: number } = {},
): Promise<void> {
  const selector = `[data-${feature}="${expected}"]`;
  await page.locator(selector).first().waitFor({
    state: "attached",
    timeout: options.timeout ?? 10_000,
  });
}
