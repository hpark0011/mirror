#!/usr/bin/env node

/**
 * Hard validator for issue ticket markdown files.
 * Zero dependencies — uses only Node.js built-ins.
 *
 * Usage:
 *   node validate.mjs <file.md> [file2.md ...]
 *   node validate.mjs <directory>
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, dirname, resolve } from "node:path";

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_TYPES = [
  "feature",
  "fix",
  "improvement",
  "chore",
  "docs",
  "refactor",
  "perf",
];
const VALID_STATUSES = [
  "backlog",
  "to-do",
  "in-progress",
  "in-review",
  "completed",
  "canceled",
];
const VALID_PRIORITIES = ["p0", "p1", "p2", "p3"];
const REQUIRED_SECTIONS = [
  "Context",
  "Scope",
  "Approach",
  "Implementation Steps",
];
// Optional sections (Goal, Out of Scope, Constraints, Resources) used to be
// required, but >40% of real tickets ended up with empty filler in each of
// those — Goal in particular was empty/restating the title 96% of the time.
// They're now opt-in: include them when there's actual content to put there.
const ID_PATTERN = /^FG_\d{3}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FILENAME_PATTERN = /^FG_\d{3}-p[0-3]-[a-z0-9-]+\.md$/;

// ── YAML Front Matter Parser ─────────────────────────────────────────────────

function parseFrontmatter(content) {
  // Strip leading HTML comments (e.g. <!-- File location: ... -->)
  const stripped = content.replace(/^<!--[\s\S]*?-->\s*/, "");
  const match = stripped.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1];
  const fm = {};
  let currentKey = null;
  let listItems = null;

  for (const line of yaml.split("\n")) {
    // List item under current key
    const listMatch = line.match(/^\s+-\s+"?(.*?)"?\s*$/);
    if (listMatch && currentKey) {
      if (!listItems) listItems = [];
      listItems.push(listMatch[1]);
      continue;
    }

    // If we were collecting list items, flush them
    if (listItems !== null && currentKey) {
      fm[currentKey] = listItems;
      listItems = null;
    }

    // Key-value pair
    const kvMatch = line.match(/^([a-z_]+):\s*(.*?)\s*$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const rawValue = kvMatch[2];

      if (rawValue === "" || rawValue === undefined) {
        // Could be a list or empty value — wait for next lines
        fm[currentKey] = undefined;
      } else if (rawValue === "[]") {
        fm[currentKey] = [];
      } else {
        // Strip surrounding quotes
        fm[currentKey] = rawValue.replace(/^["']|["']$/g, "");
      }
    }
  }

  // Flush any trailing list
  if (listItems !== null && currentKey) {
    fm[currentKey] = listItems;
  }

  // Parse dependencies that are inline arrays like [FG_001, FG_002]
  if (typeof fm.dependencies === "string") {
    const depStr = fm.dependencies.replace(/^\[|\]$/g, "").trim();
    fm.dependencies = depStr ? depStr.split(/,\s*/) : [];
  }

  return fm;
}

// ── Validators ───────────────────────────────────────────────────────────────

function validateFrontmatter(fm, errors, warnings) {
  if (!fm) {
    errors.push("Missing YAML frontmatter (no --- ... --- block found)");
    return;
  }

  // id
  if (!fm.id) {
    errors.push("Missing required field: id");
  } else if (!ID_PATTERN.test(fm.id)) {
    errors.push(`Invalid id "${fm.id}" — must match FG_NNN (3-digit zero-padded)`);
  }

  // title
  if (!fm.title) {
    errors.push("Missing required field: title");
  } else if (fm.title.length > 80) {
    errors.push(`Title exceeds 80 chars (${fm.title.length}): "${fm.title}"`);
  }

  // date
  if (!fm.date) {
    errors.push("Missing required field: date");
  } else if (!DATE_PATTERN.test(String(fm.date))) {
    errors.push(`Invalid date "${fm.date}" — must be YYYY-MM-DD`);
  }

  // type
  if (!fm.type) {
    errors.push("Missing required field: type");
  } else if (!VALID_TYPES.includes(fm.type)) {
    errors.push(`Invalid type "${fm.type}" — must be one of: ${VALID_TYPES.join(", ")}`);
  }

  // status
  if (!fm.status) {
    errors.push("Missing required field: status");
  } else if (!VALID_STATUSES.includes(fm.status)) {
    errors.push(
      `Invalid status "${fm.status}" — must be one of: ${VALID_STATUSES.join(", ")}`
    );
  }

  // priority
  if (!fm.priority) {
    errors.push("Missing required field: priority");
  } else if (!VALID_PRIORITIES.includes(fm.priority)) {
    errors.push(
      `Invalid priority "${fm.priority}" — must be one of: ${VALID_PRIORITIES.join(", ")}`
    );
  }

  // description
  if (!fm.description) {
    errors.push("Missing required field: description");
  } else {
    const wordCount = fm.description.trim().split(/\s+/).length;
    if (wordCount < 10) {
      errors.push(`Description too short (${wordCount} words) — minimum 10 words`);
    }
  }

  // dependencies
  if (fm.dependencies === undefined || fm.dependencies === null) {
    errors.push("Missing required field: dependencies (use [] for none)");
  } else if (Array.isArray(fm.dependencies)) {
    for (const dep of fm.dependencies) {
      if (!ID_PATTERN.test(dep)) {
        errors.push(`Invalid dependency "${dep}" — must match FG_NNN`);
      }
    }
  }

  // acceptance_criteria
  if (
    !fm.acceptance_criteria ||
    !Array.isArray(fm.acceptance_criteria) ||
    fm.acceptance_criteria.length === 0
  ) {
    errors.push("Missing or empty required field: acceptance_criteria");
  } else {
    if (fm.acceptance_criteria.length < 2) {
      errors.push(
        `Only ${fm.acceptance_criteria.length} acceptance criterion — minimum 2 required`
      );
    }
    if (fm.acceptance_criteria.length > 7) {
      warnings.push(
        `${fm.acceptance_criteria.length} acceptance criteria — consider decomposing (max recommended: 7)`
      );
    }
  }

  // owner_agent was a decorative field — no downstream consumer reads it
  // (resolve-issue-tickets picks subagent_type from priority + path heuristics).
  // No validation; the field is allowed but ignored if present.
}

function validateBody(content, errors, warnings) {
  // Strip frontmatter
  const body = content.replace(/^---[\s\S]*?---/, "").trim();

  for (const section of REQUIRED_SECTIONS) {
    const pattern = new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, "m");
    if (!pattern.test(body)) {
      errors.push(`Missing required body section: ## ${section}`);
    }
  }
}

function validateFilename(filepath, fm, warnings) {
  const name = basename(filepath);
  if (!FILENAME_PATTERN.test(name)) {
    warnings.push(
      `Filename "${name}" doesn't match convention FG_NNN-pN-slug.md`
    );
  }
}

function validateDirectoryStatus(filepath, fm, errors) {
  if (!fm?.status) return;
  const parentDir = basename(dirname(filepath));
  const statusDirs = new Set(VALID_STATUSES);
  if (!statusDirs.has(parentDir)) return; // file not in a status directory
  if (parentDir !== fm.status) {
    errors.push(
      `Directory "${parentDir}" does not match frontmatter status "${fm.status}"`
    );
  }
}

// ── Cross-file checks ────────────────────────────────────────────────────────

function crossValidate(results, errors) {
  const ids = new Map(); // id → filepath

  // Collect all IDs
  for (const { filepath, fm } of results) {
    if (!fm?.id) continue;
    if (ids.has(fm.id)) {
      errors.push(
        `Duplicate ID ${fm.id} in "${basename(filepath)}" and "${basename(ids.get(fm.id))}"`
      );
    } else {
      ids.set(fm.id, filepath);
    }
  }

  const allIds = new Set(ids.keys());

  // Check dependency references exist
  for (const { filepath, fm } of results) {
    if (!fm?.dependencies || !Array.isArray(fm.dependencies)) continue;
    for (const dep of fm.dependencies) {
      if (ID_PATTERN.test(dep) && !allIds.has(dep)) {
        errors.push(
          `${fm.id} depends on ${dep} which doesn't exist in the validated set`
        );
      }
    }
  }

  // Cycle detection (DFS)
  const adj = new Map();
  for (const { fm } of results) {
    if (!fm?.id) continue;
    adj.set(fm.id, (fm.dependencies || []).filter((d) => allIds.has(d)));
  }

  const visited = new Set();
  const stack = new Set();

  function hasCycle(node, path) {
    if (stack.has(node)) {
      const cycle = [...path.slice(path.indexOf(node)), node];
      errors.push(`Circular dependency: ${cycle.join(" → ")}`);
      return true;
    }
    if (visited.has(node)) return false;
    visited.add(node);
    stack.add(node);
    path.push(node);
    for (const neighbor of adj.get(node) || []) {
      if (hasCycle(neighbor, path)) return true;
    }
    path.pop();
    stack.delete(node);
    return false;
  }

  for (const id of adj.keys()) {
    if (!visited.has(id)) hasCycle(id, []);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function collectFiles(args) {
  const files = [];
  for (const arg of args) {
    const resolved = resolve(arg);
    try {
      if (statSync(resolved).isDirectory()) {
        for (const entry of readdirSync(resolved)) {
          if (entry.endsWith(".md")) files.push(join(resolved, entry));
        }
      } else {
        files.push(resolved);
      }
    } catch {
      console.error(`Cannot access: ${arg}`);
      process.exit(1);
    }
  }
  return files;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: node validate.mjs <file.md> [file2.md ...]\n       node validate.mjs <directory>"
    );
    process.exit(1);
  }

  const files = collectFiles(args);
  if (files.length === 0) {
    console.error("No .md files found.");
    process.exit(1);
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  const results = [];

  for (const filepath of files) {
    const content = readFileSync(filepath, "utf-8");
    const fm = parseFrontmatter(content);
    const errors = [];
    const warnings = [];

    validateFrontmatter(fm, errors, warnings);
    validateBody(content, errors, warnings);
    validateFilename(filepath, fm, warnings);
    validateDirectoryStatus(filepath, fm, errors);

    results.push({ filepath, fm, errors, warnings });
    totalErrors += errors.length;
    totalWarnings += warnings.length;
  }

  // Cross-file checks when multiple files
  if (results.length > 1) {
    const crossErrors = [];
    crossValidate(results, crossErrors);
    if (crossErrors.length > 0) {
      totalErrors += crossErrors.length;
      // Attach cross-file errors to a virtual entry
      results.push({
        filepath: "(cross-file)",
        fm: null,
        errors: crossErrors,
        warnings: [],
      });
    }
  }

  // Report
  for (const { filepath, errors, warnings } of results) {
    const name = filepath === "(cross-file)" ? filepath : basename(filepath);
    if (errors.length === 0 && warnings.length === 0) {
      console.log(`✓ ${name}`);
      continue;
    }
    if (errors.length > 0) {
      console.log(`✗ ${name}`);
      for (const e of errors) console.log(`  ERROR: ${e}`);
    } else {
      console.log(`~ ${name}`);
    }
    for (const w of warnings) console.log(`  WARN:  ${w}`);
  }

  // Summary
  console.log(
    `\n${files.length} file(s) checked. ${totalErrors} error(s), ${totalWarnings} warning(s).`
  );
  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
