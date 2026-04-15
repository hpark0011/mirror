#!/usr/bin/env node
/**
 * Idempotently register the SubagentStop enforcement hook in
 * .claude/settings.json.
 *
 * Usage:
 *   node .claude/skills/create-codebase-expert/scripts/install-hook.mjs [--repo-root PATH]
 *
 * Behavior:
 *   - Locates .claude/ from cwd (or --repo-root if given).
 *   - Reads .claude/settings.json if present; creates minimal structure otherwise.
 *   - Ensures hooks.SubagentStop contains exactly one matcher entry whose
 *     command references validate-session-log.mjs. Never duplicates.
 *   - Preserves all other settings/hooks untouched.
 *   - Writes back with 2-space indentation and a trailing newline.
 *   - Exit 0 on success (installed or already present, both logged).
 *   - Exit 1 on any error.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { argv, cwd, exit, stderr, stdout } from "node:process";

const HOOK_COMMAND =
  "node .claude/skills/create-codebase-expert/scripts/validate-session-log.mjs";
const HOOK_MARKER = "validate-session-log.mjs";

function parseArgs() {
  const args = { repoRoot: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--repo-root") args.repoRoot = argv[++i];
  }
  return args;
}

function findRepoRoot(startDir) {
  let dir = resolve(startDir);
  while (dir !== "/") {
    if (existsSync(join(dir, ".claude"))) return dir;
    dir = dirname(dir);
  }
  return null;
}

function loadSettings(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function alreadyInstalled(settings) {
  const entries = settings?.hooks?.SubagentStop;
  if (!Array.isArray(entries)) return false;
  for (const entry of entries) {
    const hooks = entry?.hooks;
    if (!Array.isArray(hooks)) continue;
    for (const h of hooks) {
      if (h?.type === "command" && typeof h.command === "string" && h.command.includes(HOOK_MARKER)) {
        return true;
      }
    }
  }
  return false;
}

function installHook(settings) {
  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks.SubagentStop)) settings.hooks.SubagentStop = [];
  settings.hooks.SubagentStop.push({
    matcher: "",
    hooks: [{ type: "command", command: HOOK_COMMAND }],
  });
  return settings;
}

function main() {
  try {
    const { repoRoot: rootArg } = parseArgs();
    const repoRoot = rootArg ? resolve(rootArg) : findRepoRoot(cwd());
    if (!repoRoot) {
      stderr.write("[install-hook] could not locate .claude/ from cwd\n");
      exit(1);
    }
    const claudeDir = join(repoRoot, ".claude");
    if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });
    const settingsPath = join(claudeDir, "settings.json");

    const settings = loadSettings(settingsPath);
    if (alreadyInstalled(settings)) {
      stdout.write(`[install-hook] already present in ${settingsPath}\n`);
      exit(0);
    }
    const updated = installHook(settings);
    writeFileSync(settingsPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
    stdout.write(`[install-hook] installed SubagentStop hook in ${settingsPath}\n`);
    exit(0);
  } catch (e) {
    stderr.write(`[install-hook] error: ${e.message}\n`);
    exit(1);
  }
}

main();
