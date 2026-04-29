#!/usr/bin/env node
/**
 * SubagentStop hook: enforce step 5 (Log & Patch) of the create-codebase-expert loop.
 *
 * Reads the standard SubagentStop hook payload from stdin:
 *   { session_id, transcript_path, stop_hook_active, ... }
 *
 * Contract:
 *   1. Parse the subagent transcript (JSONL).
 *   2. Determine whether this subagent is a domain expert registered under
 *      .claude/agents/ AND has an agent-memory/<name>/ directory. If not,
 *      exit 0 (no-op — we only enforce against domain experts).
 *   3. Scan the transcript for any successful Write/Edit tool_use that
 *      targets .claude/agent-memory/<name>/logs.md during this session.
 *   4. Re-read logs.md and confirm it contains an entry with all three
 *      required markers: "Bottleneck", "Counterfactual", "Patch".
 *   5. If any check fails, emit a blocking message on stderr and exit 2,
 *      which Claude Code surfaces back to the subagent so it can loop and
 *      actually write the log entry before ending.
 *
 * Exit codes:
 *   0  → pass (or not applicable)
 *   2  → block: subagent must complete step 5 before stopping
 *   1  → internal error (bad payload, unreadable transcript). Fail-open to
 *        avoid wedging sessions on infra bugs — we print a warning but do
 *        not block.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { exit, stdin, stderr } from "node:process";

const REQUIRED_MARKERS = ["Bottleneck", "Counterfactual", "Patch"];

function readStdinSync() {
  const chunks = [];
  try {
    const fd = 0;
    const buf = Buffer.alloc(65536);
    let bytes;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        bytes = readFileSync(fd);
        chunks.push(bytes);
        break;
      } catch (e) {
        if (e.code === "EAGAIN") continue;
        throw e;
      }
    }
  } catch (e) {
    return "";
  }
  return Buffer.concat(chunks).toString("utf8");
}

function findRepoRoot(startDir) {
  let dir = resolve(startDir);
  while (dir !== "/") {
    if (existsSync(join(dir, ".claude"))) return dir;
    dir = dirname(dir);
  }
  return startDir;
}

function loadTranscript(path) {
  if (!path || !existsSync(path)) return [];
  const raw = readFileSync(path, "utf8");
  const entries = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      /* skip malformed lines */
    }
  }
  return entries;
}

function listDomainAgents(repoRoot) {
  const agentsDir = join(repoRoot, ".claude", "agents");
  const memoryDir = join(repoRoot, ".claude", "agent-memory");
  if (!existsSync(agentsDir) || !existsSync(memoryDir)) return [];
  const specs = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  const names = [];
  for (const spec of specs) {
    const name = basename(spec, ".md");
    if (existsSync(join(memoryDir, name, "logs.md"))) names.push(name);
  }
  return names;
}

function detectSubagentName(entries, domainAgents) {
  // Strategy: scan any message content / system prompt text in the transcript
  // for references to an agent name that matches a known domain expert. The
  // subagent's system prompt typically includes "You own <domain>" from the
  // spec, plus a pointer to .claude/agent-memory/<name>/. Either signal
  // positively identifies the agent.
  const hay = JSON.stringify(entries);
  let match = null;
  for (const name of domainAgents) {
    const needle = `agent-memory/${name}/`;
    if (hay.includes(needle)) {
      match = name;
      break;
    }
  }
  return match;
}

function sessionWroteToLogs(entries, logsPath) {
  // Look for any tool_use entry for Write or Edit whose input targets the
  // agent's logs.md file. Accept both absolute and relative paths.
  const rel = logsPath;
  const abs = resolve(logsPath);
  for (const e of entries) {
    const msg = e?.message ?? e;
    const content = msg?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== "tool_use") continue;
      const name = block.name;
      if (name !== "Write" && name !== "Edit") continue;
      const p = block.input?.file_path ?? "";
      if (!p) continue;
      if (p === abs || p === rel || p.endsWith("/agent-memory/" + basename(dirname(abs)) + "/logs.md")) {
        return true;
      }
    }
  }
  return false;
}

function splitIntoSections(text) {
  // Split on H2/H3 headings. A "section" is the heading line plus everything
  // until the next heading of equal or greater depth. We treat any ## or ###
  // line as a section start — entries in logs.md conventionally use one of
  // these.
  const lines = text.split("\n");
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (/^#{2,3}\s/.test(line)) {
      if (current) sections.push(current);
      current = { heading: line, body: [line] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) sections.push(current);
  return sections.map((s) => s.body.join("\n"));
}

function sectionHasAllMarkers(section) {
  for (const marker of REQUIRED_MARKERS) {
    if (!new RegExp(`\\b${marker}\\b`, "i").test(section)) return false;
  }
  return true;
}

function logsHasCompleteEntry(logsPath, minMtimeMs) {
  if (!existsSync(logsPath)) return { ok: false, reason: "logs.md does not exist" };

  // Freshness check: the file must have been modified during this session.
  // We accept either the mtime being after the transcript's start, or (as a
  // fallback when we cannot read a start time) any mtime within the last hour.
  const stat = statSync(logsPath);
  const mtimeMs = stat.mtimeMs;
  const freshThreshold = minMtimeMs ?? Date.now() - 60 * 60 * 1000;
  if (mtimeMs < freshThreshold) {
    return {
      ok: false,
      reason: `logs.md was not modified during this session (mtime ${new Date(mtimeMs).toISOString()})`,
    };
  }

  const text = readFileSync(logsPath, "utf8");
  const sections = splitIntoSections(text);
  if (sections.length === 0) {
    return { ok: false, reason: "logs.md contains no ## entries" };
  }

  // At least one section must carry all three markers AND look like a real
  // entry, not the scaffold. A "real" section has a non-trivial amount of
  // non-heading, non-comment content.
  for (const section of sections) {
    if (!sectionHasAllMarkers(section)) continue;
    const content = section
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return t && !t.startsWith("<!--") && !t.startsWith("#");
      })
      .join(" ");
    if (content.length >= 60) return { ok: true };
  }

  return {
    ok: false,
    reason: `no section in logs.md contains all three markers (${REQUIRED_MARKERS.join(", ")}) with substantive content`,
  };
}

function transcriptStartMs(entries) {
  // Best-effort: find the earliest timestamp in the transcript. JSONL entries
  // from Claude Code typically carry a `timestamp` field (ISO 8601).
  let earliest = Infinity;
  for (const e of entries) {
    const ts = e?.timestamp ?? e?.message?.timestamp;
    if (!ts) continue;
    const ms = Date.parse(ts);
    if (!Number.isNaN(ms) && ms < earliest) earliest = ms;
  }
  return Number.isFinite(earliest) ? earliest : null;
}

function block(message) {
  stderr.write(message + "\n");
  exit(2);
}

function warnAndPass(message) {
  stderr.write(`[validate-session-log] ${message}\n`);
  exit(0);
}

function main() {
  let payload;
  try {
    const raw = readStdinSync();
    payload = raw ? JSON.parse(raw) : {};
  } catch (e) {
    return warnAndPass(`could not parse hook payload: ${e.message}`);
  }

  // Avoid infinite loops if the hook has already fired once this stop cycle.
  if (payload.stop_hook_active) return exit(0);

  const transcriptPath = payload.transcript_path;
  const cwdHint = payload.cwd || process.cwd();
  const repoRoot = findRepoRoot(cwdHint);
  const domainAgents = listDomainAgents(repoRoot);
  if (domainAgents.length === 0) return exit(0);

  const entries = loadTranscript(transcriptPath);
  if (entries.length === 0) return exit(0);

  const agentName = detectSubagentName(entries, domainAgents);
  if (!agentName) return exit(0); // not a domain-expert subagent — no-op

  const logsPath = join(repoRoot, ".claude", "agent-memory", agentName, "logs.md");

  const wrote = sessionWroteToLogs(entries, logsPath);
  const startMs = transcriptStartMs(entries);
  const check = logsHasCompleteEntry(logsPath, startMs);

  if (wrote && check.ok) return exit(0);

  const reason = !wrote
    ? `no Write/Edit to ${logsPath} was observed in this session`
    : check.reason;

  block(
    [
      `[${agentName}] Step 5 of the operating loop is incomplete — ${reason}.`,
      "",
      "Before ending this session, append a new entry to:",
      `  ${logsPath}`,
      "",
      "The entry MUST include all three of:",
      "  • Bottleneck:   the single biggest friction this session",
      "  • Counterfactual: 'If this patch existed at session start, it would",
      "                    have cost N iterations instead of M, because <mechanism>.'",
      "  • Patch:         a concrete edit to knowledge.md or the agent spec",
      "",
      "A session without a log entry breaks the self-improvement contract.",
      "Do not end the session — write the entry now, then stop.",
    ].join("\n"),
  );
}

main();
