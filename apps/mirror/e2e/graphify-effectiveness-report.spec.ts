import { expect, test } from "@playwright/test";

const repoRoot = process.cwd().endsWith("/apps/mirror")
  ? process.cwd().slice(0, -"/apps/mirror".length)
  : process.cwd();
const reportUrl = `file://${repoRoot}/workspace/reports/graphify-effectiveness/latest.html`;

test.describe("Graphify effectiveness report", () => {
  test("renders the generated metric report", async ({ page }) => {
    await page.goto(reportUrl);

    await expect(
      page.getByRole("heading", { name: "Graphify Effectiveness" }),
    ).toBeVisible();
    await expect(page.getByText("Graph-native adoption")).toBeVisible();
    await expect(page.getByText("Median reads before first edit")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recommended patch" }),
    ).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\b(?:NaN|undefined|Infinity)\b/);
    await expect(page.locator("tr[data-status='pass'], tr[data-status='warn'], tr[data-status='fail']").first()).toBeVisible();
  });
});
