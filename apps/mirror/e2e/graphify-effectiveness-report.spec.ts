import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";

const appRootSuffix = `${sep}apps${sep}mirror`;
const repoRoot = process.cwd().endsWith(appRootSuffix)
  ? process.cwd().slice(0, -appRootSuffix.length)
  : process.cwd();
const reportDir = mkdtempSync(join(tmpdir(), "graphify-effectiveness-report-"));
const reportPath = join(reportDir, "latest.html");
execFileSync(
  "node",
  [
    join(repoRoot, "scripts", "measure-graphify-effectiveness.mjs"),
    "--days",
    "14",
    "--format",
    "html",
    "--out",
    reportPath,
  ],
  { cwd: repoRoot, stdio: "pipe" },
);
const reportUrl = pathToFileURL(reportPath).href;

test.describe("Graphify effectiveness report", () => {
  test.afterAll(() => {
    rmSync(reportDir, { recursive: true, force: true });
  });

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
