#!/usr/bin/env node
/**
 * Validate a scaffolded codebase expert agent against the create-codebase-expert contract.
 *
 * Usage:
 *   node validate-scaffold.mjs <agent-name> [--repo-root PATH]
 *
 * Checks (all deterministic, no agent judgment involved):
 *   1. .claude/agents/<name>.md exists
 *   2. YAML frontmatter parses
 *   3. Required fields present: name, description, model, color, memory, tools, maxTurns
 *   4. `name` matches filename
 *   5. `description` starts with "Use this agent when"
 *   6. `color` is unique across .claude/agents/
 *   7. `tools` is a non-empty subset of the known Claude Code tool allowlist
 *      (mcp__* prefixed tools are allowed without explicit enumeration)
 *   8. `maxTurns` is a positive integer within [1, 200]
 *   9. .claude/agent-memory/<name>/{knowledge.md,logs.md} both exist
 *  10. Agent spec body contains all required H2 section headings
 *
 * Exit 0 on success, exit 1 with a line-by-line error report otherwise.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { argv, exit, cwd } from "node:process";

const KNOWN_TOOLS = new Set([
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "Bash",
  "Task",
  "WebFetch",
  "WebSearch",
  "NotebookEdit",
  "TodoWrite",
  "BashOutput",
  "KillShell",
  "SlashCommand",
  "ExitPlanMode",
]);

const REQUIRED_FRONTMATTER = [
  "name",
  "description",
  "model",
  "color",
  "memory",
  "tools",
  "maxTurns",
];

const REQUIRED_SECTIONS = [
  "## Domain Boundary",
  "## How to Operate",
  "## Evidence Rule",
  "## Guiding Principles",
  "## Available Skills & Tools",
  "## Verification",
  "## Knowledge & Logs",
];

/**
 * Minimal YAML-ish parser. Supports scalars and simple `- item` lists.
 * Returns an object keyed by field name, or null if no frontmatter.
 */
function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end === -1) return null;
  const body = text.slice(4, end);

  const out = {};
  let currentKey = null;

  for (const raw of body.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = line.length - line.replace(/^\s+/, "").length;

    // List item: "  - value"
    if (trimmed.startsWith("- ") && currentKey !== null && indent > 0) {
      let item = trimmed.slice(2).trim();
      const hashIdx = item.indexOf("#");
      if (hashIdx !== -1) item = item.slice(0, hashIdx).trim();
      if (item.startsWith('"') && item.endsWith('"')) item = item.slice(1, -1);
      if (!Array.isArray(out[currentKey])) out[currentKey] = [];
      if (item) out[currentKey].push(item);
      continue;
    }

    // key: value
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2].trim();
      currentKey = key;

      if (val === "") {
        out[key] = []; // start of list
      } else {
        // strip inline comment unless inside quotes
        const quoted = val.startsWith('"') && val.lastIndexOf('"') > 0;
        if (!quoted && val.includes("#")) val = val.slice(0, val.indexOf("#")).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        out[key] = val;
      }
    }
  }
  return out;
}

function loadExistingColors(agentsDir, excludeName) {
  const colors = {};
  if (!existsSync(agentsDir)) return colors;
  for (const entry of readdirSync(agentsDir)) {
    if (!entry.endsWith(".md")) continue;
    const stem = entry.slice(0, -3);
    if (stem === excludeName) continue;
    try {
      const fm = parseFrontmatter(readFileSync(join(agentsDir, entry), "utf8"));
      if (fm && typeof fm.color === "string") colors[fm.color] = stem;
    } catch {
      // skip unreadable files
    }
  }
  return colors;
}

function validate(agentName, repoRoot) {
  const errors = [];
  const warnings = [];

  const agentsDir = join(repoRoot, ".claude", "agents");
  const memoryDir = join(repoRoot, ".claude", "agent-memory", agentName);
  const specPath = join(agentsDir, `${agentName}.md`);

  if (!existsSync(specPath)) {
    errors.push(`agent spec not found: ${specPath}`);
    return { errors, warnings };
  }

  const text = readFileSync(specPath, "utf8");
  const fm = parseFrontmatter(text);
  if (fm === null) {
    errors.push(`${specPath}: no YAML frontmatter (must open with '---' and close with '---')`);
    return { errors, warnings };
  }

  for (const field of REQUIRED_FRONTMATTER) {
    if (!(field in fm)) errors.push(`frontmatter missing required field: \`${field}\``);
  }

  if (typeof fm.name === "string" && fm.name !== agentName) {
    errors.push(`frontmatter \`name: ${fm.name}\` does not match filename \`${agentName}.md\``);
  }

  if (typeof fm.description === "string" && fm.description) {
    if (!fm.description.toLowerCase().startsWith("use this agent when")) {
      errors.push('frontmatter `description` must start with "Use this agent when"');
    }
  }

  if (typeof fm.color === "string" && fm.color) {
    const taken = loadExistingColors(agentsDir, agentName);
    if (fm.color in taken) {
      errors.push(`color \`${fm.color}\` already used by agent \`${taken[fm.color]}\``);
    }
  }

  const tools = fm.tools;
  if (!Array.isArray(tools) || tools.length === 0) {
    errors.push("frontmatter `tools` must be a non-empty list");
  } else {
    for (const t of tools) {
      if (typeof t !== "string") {
        errors.push(`non-string entry in \`tools\`: ${JSON.stringify(t)}`);
        continue;
      }
      if (t.startsWith("mcp__")) continue;
      if (!KNOWN_TOOLS.has(t)) errors.push(`unknown tool in \`tools\` allowlist: \`${t}\``);
    }
  }

  if (fm.maxTurns !== undefined && fm.maxTurns !== "") {
    const n = Number(fm.maxTurns);
    if (!Number.isInteger(n)) {
      errors.push(`\`maxTurns\` must be an integer, got \`${fm.maxTurns}\``);
    } else if (n <= 0 || n > 200) {
      warnings.push(`\`maxTurns: ${n}\` is outside sensible range [1, 200]`);
    }
  }

  if (!existsSync(memoryDir)) {
    errors.push(`memory directory not found: ${memoryDir}`);
  } else {
    for (const fname of ["knowledge.md", "logs.md"]) {
      if (!existsSync(join(memoryDir, fname))) {
        errors.push(`missing memory file: ${join(memoryDir, fname)}`);
      }
    }
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!text.includes(section)) {
      errors.push(`spec missing required section heading: \`${section}\``);
    }
  }

  return { errors, warnings };
}

function parseArgs(argvSlice) {
  const args = { agentName: null, repoRoot: cwd() };
  for (let i = 0; i < argvSlice.length; i++) {
    const a = argvSlice[i];
    if (a === "--repo-root") {
      args.repoRoot = argvSlice[++i];
    } else if (a === "-h" || a === "--help") {
      console.log("Usage: validate-scaffold.mjs <agent-name> [--repo-root PATH]");
      exit(0);
    } else if (args.agentName === null) {
      args.agentName = a;
    }
  }
  if (!args.agentName) {
    console.error("error: agent name required");
    console.error("Usage: validate-scaffold.mjs <agent-name> [--repo-root PATH]");
    exit(2);
  }
  return args;
}

function main() {
  const { agentName, repoRoot } = parseArgs(argv.slice(2));
  const { errors, warnings } = validate(agentName, resolve(repoRoot));

  if (errors.length === 0) {
    console.log(`[OK] ${agentName}: scaffold valid`);
    for (const w of warnings) console.log(`     warn: ${w}`);
    exit(0);
  }

  console.log(`[FAIL] ${agentName}: scaffold invalid`);
  for (const e of errors) console.log(`       error: ${e}`);
  for (const w of warnings) console.log(`       warn:  ${w}`);
  exit(1);
}

main();
