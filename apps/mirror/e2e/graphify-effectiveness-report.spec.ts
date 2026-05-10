import { expect, test } from "@playwright/test";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";

const appRootSuffix = `${sep}apps${sep}mirror`;
const repoRoot = process.cwd().endsWith(appRootSuffix)
  ? process.cwd().slice(0, -appRootSuffix.length)
  : process.cwd();
const reportPath = join(repoRoot, "workspace", "reports", "graphify-effectiveness", "latest.html");
const reportUrl = pathToFileURL(reportPath).href;

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
