#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_TEST_EMAIL = "playwright-test@mirror.test";
const DEFAULT_OLDER_THAN_HOURS = 24;
const DEFAULT_MAX_ROWS = 200;

function usage() {
  console.log(`Usage:
  node scripts/cleanup-convex-storage.mjs [options]

Options:
  --delete                         Delete matching storage. Default is dry-run.
  --include-test-cover-media        Also clear stale draft cover media from video e2e test articles.
  --older-than-hours <hours>        Only consider storage older than this many hours. Default: ${DEFAULT_OLDER_THAN_HOURS}.
  --max-storage-rows <count>        Max _storage rows to scan per deployment. Default: ${DEFAULT_MAX_ROWS}.
  --max-articles <count>            Max test-user articles to inspect. Default: ${DEFAULT_MAX_ROWS}.
  --email <email>                   Test user email. Default: ${DEFAULT_TEST_EMAIL}.
  --site-url <url>                  Convex site URL to clean instead of reading env files.
  --deployment <name>               Label for --site-url output.
  --secret <secret>                 Playwright test secret. Defaults to env / apps/mirror/.env.local.
  --all-local-worktrees             Scan the main repo and .worktrees for Convex site URLs.
  --help                            Show this help.

Examples:
  node scripts/cleanup-convex-storage.mjs --include-test-cover-media
  node scripts/cleanup-convex-storage.mjs --delete --include-test-cover-media
  node scripts/cleanup-convex-storage.mjs --all-local-worktrees --delete --include-test-cover-media
`);
}

function parseArgs(argv) {
  const opts = {
    delete: false,
    includeTestCoverMedia: false,
    olderThanHours: DEFAULT_OLDER_THAN_HOURS,
    maxStorageRows: DEFAULT_MAX_ROWS,
    maxArticles: DEFAULT_MAX_ROWS,
    email: DEFAULT_TEST_EMAIL,
    allLocalWorktrees: false,
    siteUrl: undefined,
    deployment: "current",
    secret: process.env.PLAYWRIGHT_TEST_SECRET,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      continue;
    } else if (arg === "--delete") {
      opts.delete = true;
    } else if (arg === "--include-test-cover-media") {
      opts.includeTestCoverMedia = true;
    } else if (arg === "--all-local-worktrees") {
      opts.allLocalWorktrees = true;
    } else if (arg === "--older-than-hours") {
      opts.olderThanHours = Number(argv[++i]);
    } else if (arg === "--max-storage-rows") {
      opts.maxStorageRows = Number(argv[++i]);
    } else if (arg === "--max-articles") {
      opts.maxArticles = Number(argv[++i]);
    } else if (arg === "--email") {
      opts.email = argv[++i];
    } else if (arg === "--site-url") {
      opts.siteUrl = argv[++i];
    } else if (arg === "--deployment") {
      opts.deployment = argv[++i];
    } else if (arg === "--secret") {
      opts.secret = argv[++i];
    } else if (arg === "--help") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  for (const [name, value] of [
    ["older-than-hours", opts.olderThanHours],
    ["max-storage-rows", opts.maxStorageRows],
    ["max-articles", opts.maxArticles],
  ]) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`--${name} must be a non-negative number`);
    }
  }

  return opts;
}

function repoRoot() {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
}

function gitCommonDir(root) {
  const value = execFileSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\s+#.*$/, "").trim();
    out[key] = value;
  }
  return out;
}

function deploymentName(value) {
  const match = /^dev:([a-z0-9-]+)/.exec(value ?? "");
  return match ? match[1] : value;
}

function targetFromRoot(root, fallbackSecret) {
  const convexEnv = parseEnvFile(path.join(root, "packages/convex/.env.local"));
  const appEnv = parseEnvFile(path.join(root, "apps/mirror/.env.local"));
  const siteUrl =
    convexEnv.CONVEX_SITE_URL ?? appEnv.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!siteUrl) return null;

  return {
    root,
    deployment: convexEnv.CONVEX_DEPLOYMENT ?? appEnv.CONVEX_DEPLOYMENT ?? root,
    siteUrl,
    secret: fallbackSecret ?? appEnv.PLAYWRIGHT_TEST_SECRET,
  };
}

function discoverTargets(root, opts) {
  if (opts.siteUrl) {
    return [
      {
        root,
        deployment: opts.deployment,
        siteUrl: opts.siteUrl,
        secret: opts.secret,
      },
    ];
  }

  const roots = new Set([root]);
  if (opts.allLocalWorktrees) {
    const commonDir = gitCommonDir(root);
    const mainRoot =
      path.basename(commonDir) === ".git" ? path.dirname(commonDir) : root;
    roots.add(mainRoot);

    const worktreesDir = path.join(mainRoot, ".worktrees");
    if (fs.existsSync(worktreesDir)) {
      for (const entry of fs.readdirSync(worktreesDir, {
        withFileTypes: true,
      })) {
        if (entry.isDirectory()) {
          roots.add(path.join(worktreesDir, entry.name));
        }
      }
    }
  }

  const targets = [];
  const seenSiteUrls = new Set();
  for (const candidateRoot of roots) {
    const target = targetFromRoot(candidateRoot, opts.secret);
    if (!target || seenSiteUrls.has(target.siteUrl)) continue;
    seenSiteUrls.add(target.siteUrl);
    targets.push(target);
  }
  return targets;
}

function mib(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function cleanupArgs(opts) {
  return {
    email: opts.email,
    olderThanMs: opts.olderThanHours * 60 * 60 * 1000,
    dryRun: !opts.delete,
    includeTestArticleCoverMedia: opts.includeTestCoverMedia,
    maxStorageRows: Math.floor(opts.maxStorageRows),
    maxArticles: Math.floor(opts.maxArticles),
  };
}

function extractJson(output) {
  const index = output.lastIndexOf("{");
  if (index === -1) {
    throw new Error(
      `Convex run produced no JSON result: ${output.slice(-300)}`,
    );
  }
  return JSON.parse(output.slice(index));
}

function cleanupTargetWithConvexRun(target, opts) {
  const output = execFileSync(
    "pnpm",
    [
      "--filter=@feel-good/convex",
      "exec",
      "convex",
      "run",
      "--deployment",
      deploymentName(target.deployment),
      "--push",
      "auth/testHelpers:cleanupTestStorage",
      JSON.stringify(cleanupArgs(opts)),
    ],
    {
      cwd: repoRoot(),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 180_000,
    },
  );
  return extractJson(output);
}

async function cleanupTarget(target, opts) {
  if (!target.secret) {
    throw new Error(
      `No PLAYWRIGHT_TEST_SECRET for ${target.deployment}; pass --secret or set apps/mirror/.env.local`,
    );
  }

  const response = await fetch(`${target.siteUrl}/test/cleanup-storage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": target.secret,
    },
    body: JSON.stringify(cleanupArgs(opts)),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 404) {
      return cleanupTargetWithConvexRun(target, opts);
    }
    throw new Error(
      `${target.deployment} cleanup failed (${response.status}): ${body}`,
    );
  }
  return response.json();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = repoRoot();
  const targets = discoverTargets(root, opts);
  if (targets.length === 0) {
    throw new Error("No Convex deployment targets found");
  }

  console.log(
    `${opts.delete ? "DELETE" : "DRY-RUN"} storage cleanup for ${targets.length} deployment(s)`,
  );
  console.log(
    `olderThan=${opts.olderThanHours}h includeTestCoverMedia=${opts.includeTestCoverMedia}`,
  );
  console.log("");

  for (const target of targets) {
    try {
      const result = await cleanupTarget(target, opts);
      console.log(target.deployment);
      console.log(`  scanned: ${result.storageScanned} storage row(s)`);
      console.log(
        `  unreferenced: ${result.unreferencedStorageIds} id(s), ${mib(result.unreferencedBytes)}`,
      );
      console.log(
        `  stale test cover media: ${result.staleTestArticleCoverStorageIds} id(s), ${mib(result.staleTestArticleCoverBytes)}`,
      );
      console.log(
        `  changed: patchedArticles=${result.patchedTestArticles} deletedStorage=${result.deletedStorage} deletedOwnership=${result.deletedOwnership} preservedReferenced=${result.preservedReferenced}`,
      );
    } catch (error) {
      console.error(target.deployment);
      console.error(
        `  error: ${error instanceof Error ? error.message : error}`,
      );
      process.exitCode = 1;
    }
  }

  if (!opts.delete) {
    console.log("");
    console.log(
      "Dry-run only. Re-run with --delete to remove matching storage.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
