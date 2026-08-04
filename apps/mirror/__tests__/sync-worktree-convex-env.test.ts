import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryRoots: string[] = [];
const syncScript = resolve(
  __dirname,
  "../../../scripts/sync-worktree-convex-env.sh",
);

function createFixture(appEnv: string): string {
  const root = mkdtempSync(resolve(tmpdir(), "mirror-convex-env-"));
  temporaryRoots.push(root);
  mkdirSync(resolve(root, "apps/mirror"), { recursive: true });
  mkdirSync(resolve(root, "packages/convex"), { recursive: true });
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  writeFileSync(resolve(root, "apps/mirror/.env.local"), appEnv);
  writeFileSync(
    resolve(root, "packages/convex/.env.local"),
    [
      "CONVEX_DEPLOYMENT=dev:fixture",
      "CONVEX_URL=https://fixture.convex.cloud/",
      "CONVEX_SITE_URL=https://fixture.convex.site/",
      "",
    ].join("\n"),
  );
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("sync-worktree-convex-env.sh", () => {
  it("appends missing Convex coordinates while preserving unrelated values", () => {
    const root = createFixture("NEXT_PUBLIC_SITE_URL=http://localhost:3425\n");

    execFileSync(syncScript, { cwd: root });

    expect(readFileSync(resolve(root, "apps/mirror/.env.local"), "utf8")).toBe(
      [
        "NEXT_PUBLIC_SITE_URL=http://localhost:3425",
        "CONVEX_DEPLOYMENT=dev:fixture",
        "NEXT_PUBLIC_CONVEX_URL=https://fixture.convex.cloud",
        "NEXT_PUBLIC_CONVEX_SITE_URL=https://fixture.convex.site",
        "",
      ].join("\n"),
    );
  });

  it("replaces stale coordinates without creating duplicate keys", () => {
    const root = createFixture(
      [
        "CONVEX_DEPLOYMENT=dev:stale",
        "NEXT_PUBLIC_CONVEX_URL=https://stale.convex.cloud",
        "NEXT_PUBLIC_CONVEX_SITE_URL=https://stale.convex.site",
        "",
      ].join("\n"),
    );

    execFileSync(syncScript, { cwd: root });

    const appEnv = readFileSync(
      resolve(root, "apps/mirror/.env.local"),
      "utf8",
    );
    expect(appEnv.match(/^CONVEX_DEPLOYMENT=/gm)).toHaveLength(1);
    expect(appEnv.match(/^NEXT_PUBLIC_CONVEX_URL=/gm)).toHaveLength(1);
    expect(appEnv.match(/^NEXT_PUBLIC_CONVEX_SITE_URL=/gm)).toHaveLength(1);
    expect(appEnv).toContain("CONVEX_DEPLOYMENT=dev:fixture");
  });
});
