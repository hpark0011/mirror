#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const LOCAL_ALLOWED_HOSTS = ["localhost:*", "127.0.0.1:*"];

function explicitPortArg() {
  const portFlagIndex = process.argv.indexOf("--port");
  const portValue =
    portFlagIndex >= 0 ? process.argv[portFlagIndex + 1] : undefined;
  const inlinePort = process.argv
    .find((arg) => arg.startsWith("--port="))
    ?.slice("--port=".length);
  const explicitPort = portValue ?? inlinePort;

  if (!explicitPort) {
    return undefined;
  }

  const port = Number.parseInt(explicitPort, 10);
  if (!Number.isInteger(port)) {
    throw new Error(`Invalid --port value: ${explicitPort}`);
  }

  return port;
}

function gitRoot() {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

const root = fs.realpathSync(gitRoot());

function readDeployment() {
  const convexEnvPath = path.join(root, "packages/convex/.env.local");
  if (!fs.existsSync(convexEnvPath)) {
    return undefined;
  }

  const envText = fs.readFileSync(convexEnvPath, "utf8");
  const match = envText.match(/^CONVEX_DEPLOYMENT=(.+?)(?:\s+#.*)?$/m);
  return match?.[1]?.trim().replace(/^"|"$/g, "");
}

function resolveMirrorPort() {
  const output = execFileSync(
    process.execPath,
    [path.join(root, "scripts/with-worktree-port.mjs"), "mirror", "--print"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  ).trim();
  const port = Number.parseInt(output, 10);

  if (!Number.isInteger(port)) {
    throw new Error(`Could not resolve Mirror dev port from output: ${output}`);
  }

  return port;
}

function runConvexEnv(args) {
  const result = spawnSync(
    "pnpm",
    ["--filter=@feel-good/convex", "exec", "convex", "env", ...args],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim();
    throw new Error(message || `convex env ${args[0]} failed`);
  }

  return result.stdout;
}

function parseEnvList(output) {
  const values = new Map();

  for (const line of output.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      values.set(match[1], match[2]);
    }
  }

  return values;
}

function parseCsv(value) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function mergeCsv(value, additions) {
  return Array.from(new Set([...parseCsv(value), ...additions])).join(",");
}

const deployment = readDeployment();

if (!deployment) {
  console.warn(
    "[ensure-local-auth-url] packages/convex/.env.local is not provisioned yet; skipping Convex auth URL sync.",
  );
  process.exit(0);
}

if (!deployment.startsWith("dev:")) {
  throw new Error(
    `[ensure-local-auth-url] Refusing to mutate non-dev Convex deployment: ${deployment}`,
  );
}

const mirrorPort = explicitPortArg() ?? resolveMirrorPort();
const siteUrl = `http://localhost:${mirrorPort}`;
const currentEnv = parseEnvList(runConvexEnv(["list"]));
const nextAllowedHosts = mergeCsv(
  currentEnv.get("AUTH_ALLOWED_HOSTS"),
  LOCAL_ALLOWED_HOSTS,
);
const updates = [];

if (currentEnv.get("SITE_URL") !== siteUrl) {
  runConvexEnv(["set", "SITE_URL", siteUrl]);
  updates.push(`SITE_URL=${siteUrl}`);
}

if (currentEnv.get("AUTH_ALLOWED_HOSTS") !== nextAllowedHosts) {
  runConvexEnv(["set", "AUTH_ALLOWED_HOSTS", nextAllowedHosts]);
  updates.push("AUTH_ALLOWED_HOSTS");
}

if (updates.length > 0) {
  console.log(`[ensure-local-auth-url] Updated Convex ${updates.join(", ")}.`);
} else {
  console.log(
    `[ensure-local-auth-url] Convex auth URL already points at ${siteUrl}.`,
  );
}
