#!/usr/bin/env node
/**
 * Convex codegen freshness gate.
 *
 * Recurring failure this prevents: a schema/function change lands without
 * regenerating `packages/convex/convex/_generated`, so `_generated/api.d.ts`
 * is missing entries for new modules. This surfaced repeatedly as a P0
 * "codegen finding" in code review — a class of bug that should be
 * impossible, not re-discovered per PR.
 *
 * Exposed as the `@feel-good/convex` `verify:codegen` script and required
 * by `.claude/rules/verification.md` for any change under
 * `packages/convex/convex/**`.
 *
 * IMPORTANT — Convex 1.37 `convex codegen` is NOT offline. It requires a
 * configured deployment (`CONVEX_DEPLOYMENT` / `CONVEX_DEPLOY_KEY`) and
 * pushes the working tree's functions to that deployment to derive accurate
 * `_generated/api.d.ts` types. That is why this is a deliberate pre-commit
 * verification step run in a provisioned worktree (which always has a dev
 * deployment), NOT a `lint` side-effect (lint must not mutate a deployment
 * or hard-fail without credentials) and NOT a CI gate as-is (CI has no
 * Convex deployment — a true CI gate needs an ephemeral deployment, tracked
 * separately).
 *
 * Exit 0  — `_generated` matches the current schema/functions.
 * Exit 1  — codegen produced a diff (stale committed `_generated`), or the
 *           codegen invocation failed (e.g. no deployment configured).
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const convexDir = resolve(repoRoot, "packages/convex");
const generatedPath = "packages/convex/convex/_generated";

function run(cmd, args, cwd) {
  return spawnSync(cmd, args, { cwd, stdio: "inherit", encoding: "utf8" });
}

// 1. Regenerate. `--no-install` keeps it offline by resolving the local bin.
const codegen = run("npx", ["--no-install", "convex", "codegen"], convexDir);
if (codegen.status !== 0) {
  console.error(
    "\n✗ convex codegen failed to run. Either fix the schema/function error " +
      "above, or — if it reported no deployment — run this from a " +
      "provisioned worktree with a configured Convex dev deployment " +
      "(`CONVEX_DEPLOYMENT` in packages/convex/.env.local).",
  );
  process.exit(1);
}

// 2. Fail if regeneration changed anything under _generated/.
const diff = spawnSync(
  "git",
  ["-C", repoRoot, "diff", "--exit-code", "--", generatedPath],
  { stdio: "ignore" },
);

if (diff.status !== 0) {
  const names = spawnSync(
    "git",
    ["-C", repoRoot, "diff", "--name-only", "--", generatedPath],
    { encoding: "utf8" },
  );
  console.error(
    "\n✗ Convex codegen is stale — committed `_generated` does not match the " +
      "current schema/functions.\n\n  Drifted files:\n" +
      (names.stdout || "")
        .trim()
        .split("\n")
        .map((f) => `    ${f}`)
        .join("\n") +
      "\n\n  Fix: run `pnpm --filter=@feel-good/convex generate` and commit " +
      "the regenerated `_generated/` files.\n",
  );
  process.exit(1);
}

console.log("✓ Convex codegen is up to date.");
