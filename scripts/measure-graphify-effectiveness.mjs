#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const READ_RE =
  /\b(cat|sed|rg|grep|ast-grep|fd|find|ls|tree|head|tail|wc|jq|git show|git diff|git status|nl)\b/i;
const WRITE_SHELL_RE =
  /(apply_patch|cat\s+>|tee\s+|sed\s+-i|perl\s+-pi|python3?\s+- <<|echo\s+.+>|printf\s+.+>)/is;
const GRAPH_NATIVE_RE = /(^|[;&|]\s*)graphify\s+(query|path|explain)\b/i;
const GRAPH_UPDATE_RE = /(^|[;&|]\s*)graphify\s+update\b/i;
const VALIDATION_RE =
  /\b(pytest|rspec|vitest|jest|playwright|cypress|node\s+--test|go test|cargo test|(?:npm|pnpm|yarn|bun)(?:\s+(?:--filter(?:=|\s+)\S+|--workspace(?:=|\s+)\S+|--cwd(?:=|\s+)\S+|--dir(?:=|\s+)\S+|--if-present|-[A-Za-z]+))*\s+(?:run\s+)?(?:test(?::[\w-]+)?|lint(?::[\w-]+)?|build|typecheck)|eslint|tsc|typecheck|rubocop|ruff|mypy|black --check|bundle exec|rails test|mvn test|gradle test|make test|cargo clippy|git diff --check)\b/i;
const TESTS_NOT_RUN_RE = /\b(not run|did not run|wasn.t run|unable to run|couldn.t run|not tested)\b/i;
const ELIGIBLE_TEXT_RE =
  /\b(architecture|architectural|cross-module|cross module|how does|relate|relationship|debug|investigate|review|implement|fix|plan|orchestrate|parity|graphify)\b/i;

const TARGETS = {
  graphNativeAdoptionRate: 0.7,
  medianReadsBeforeFirstEdit: 18,
  medianTimeToFirstEditSeconds: 120,
  graphUpdateComplianceRate: 0.9,
  verifiedEditRate: 0.8,
};

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    days: 14,
    format: "text",
    out: null,
    repo: process.cwd(),
    logs: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--days") {
      args.days = Number.parseInt(argv[++index] ?? "", 10);
    } else if (arg === "--format") {
      args.format = argv[++index] ?? "text";
    } else if (arg === "--out") {
      args.out = argv[++index] ?? null;
    } else if (arg === "--repo") {
      args.repo = argv[++index] ?? process.cwd();
    } else if (arg === "--logs") {
      args.logs.push(argv[++index] ?? "");
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.days) || args.days <= 0) {
    throw new Error("--days must be a positive number");
  }

  if (!["text", "json", "markdown", "html"].includes(args.format)) {
    throw new Error("--format must be text, json, markdown, or html");
  }

  return args;
}

function parseTime(value) {
  if (!value) return null;
  if (typeof value === "number") return new Date(value);
  const text = String(value).replace(/Z$/, "+00:00");
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function textFromContent(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") return item.text ?? item.content ?? item.message ?? "";
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") return value.text ?? value.content ?? value.message ?? "";
  return "";
}

function visitStringLeaves(value, visitor, seen = new Set()) {
  if (typeof value === "string") {
    visitor(value);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) visitStringLeaves(item, visitor, seen);
    return;
  }
  for (const item of Object.values(value)) visitStringLeaves(item, visitor, seen);
}

function commandFromCall(name, args) {
  if (name !== "exec_command") return name;
  return String(args.cmd ?? "");
}

function isReadCommand(name, args) {
  if (name !== "exec_command") return false;
  const cmd = commandFromCall(name, args);
  return READ_RE.test(cmd) && !WRITE_SHELL_RE.test(cmd);
}

function isEditCall(name, args) {
  if (name.includes("apply_patch") || ["edit", "write", "multiedit"].includes(name)) return true;
  if (name === "exec_command") return WRITE_SHELL_RE.test(commandFromCall(name, args));
  return false;
}

function isValidationCommand(name, args) {
  return VALIDATION_RE.test(commandFromCall(name, args));
}

function topAreaFromPath(path) {
  const normalized = String(path).replaceAll("\\", "/");
  const match = normalized.match(/(?:^|[\s"'=:\/])(apps|packages|scripts|workspace|\.claude|\.agents|tooling)\//);
  return match?.[1] ?? null;
}

function shouldIncludeRepoSession(session, repoRoot) {
  const repoName = repoRoot.split(/[\\/]/).filter(Boolean).at(-1) ?? "";
  const cwd = session.cwd || "";
  if (cwd && (cwd.includes(repoRoot) || cwd.includes("/mirror") || cwd.includes("/feel-good"))) {
    return true;
  }
  if (session.injectedInstructions.includes("Feel Good Monorepo")) return true;
  if (session.injectedInstructions.includes("graphify-out/GRAPH_REPORT.md")) return true;
  return repoName && cwd.includes(repoName);
}

function isEligibleSession(session) {
  if (!session.repoSession) return false;
  if (ELIGIBLE_TEXT_RE.test(session.userText) || ELIGIBLE_TEXT_RE.test(session.assistantText)) return true;
  if (session.touchedAreas.size > 1) return true;
  if (session.editCalls > 0 && session.readCalls >= 6) return true;
  return false;
}

function discoverJsonlFiles(paths) {
  const files = [];
  const visit = (path) => {
    if (!path || !existsSync(path)) return;
    const info = statSync(path);
    if (info.isFile() && path.endsWith(".jsonl")) {
      files.push(path);
      return;
    }
    if (!info.isDirectory()) return;
    for (const entry of readdirSync(path)) {
      visit(join(path, entry));
    }
  };
  for (const path of paths) visit(path);
  return files.sort();
}

export function defaultLogPaths(env = process.env) {
  const codexHome = env.CODEX_HOME || join(homedir(), ".codex");
  return [join(codexHome, "sessions"), join(codexHome, "archived_sessions")];
}

export function parseSessionFile(path, options = {}) {
  const repoRoot = resolve(options.repo ?? process.cwd());
  const session = {
    path,
    cwd: "",
    start: null,
    end: null,
    userText: "",
    assistantText: "",
    injectedInstructions: "",
    toolCalls: 0,
    readCalls: 0,
    editCalls: 0,
    validationCalls: 0,
    firstEditAt: null,
    lastEditAt: null,
    firstGraphNativeAt: null,
    firstGraphUpdateAfterEditAt: null,
    firstValidationAfterLastEditAt: null,
    graphNativeCalls: 0,
    graphUpdateCalls: 0,
    graphNativeBeforeBroadReads: false,
    readCallsBeforeFirstEdit: 0,
    testsNotRunMentions: 0,
    touchedAreas: new Set(),
    repoSession: false,
    eligible: false,
  };

  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
    const timestamp = parseTime(event.timestamp) ?? parseTime(payload.timestamp) ?? parseTime(payload.started_at);
    if (timestamp) {
      if (!session.start || timestamp < session.start) session.start = timestamp;
      if (!session.end || timestamp > session.end) session.end = timestamp;
    }

    if (event.type === "turn_context") {
      session.cwd = String(payload.cwd ?? session.cwd ?? "");
      session.injectedInstructions += `\n${payload.user_instructions ?? ""}`;
    }

    if (payload.type === "user_message" || payload.role === "user") {
      session.userText += `\n${textFromContent(payload.message ?? payload.content ?? payload.text)}`;
    }

    if (payload.type === "agent_message" || payload.role === "assistant") {
      const text = textFromContent(payload.message ?? payload.content ?? payload.text);
      session.assistantText += `\n${text}`;
      if (TESTS_NOT_RUN_RE.test(text)) session.testsNotRunMentions += 1;
    }

    if (event.type !== "response_item") continue;

    if (payload.type === "function_call" || payload.type === "custom_tool_call") {
      const name = String(payload.name ?? payload.tool_name ?? "");
      const args = asObject(payload.arguments ?? payload.input ?? payload.content ?? {});
      const cmd = commandFromCall(name, args);
      session.toolCalls += 1;

      visitStringLeaves(args, (value) => {
        const area = topAreaFromPath(value);
        if (area) session.touchedAreas.add(area);
      });

      if (isReadCommand(name, args)) {
        session.readCalls += 1;
        if (!session.firstEditAt) session.readCallsBeforeFirstEdit += 1;
      }

      if (GRAPH_NATIVE_RE.test(cmd)) {
        session.graphNativeCalls += 1;
        session.firstGraphNativeAt ??= timestamp;
      }

      if (isEditCall(name, args)) {
        session.editCalls += 1;
        session.firstEditAt ??= timestamp;
        session.lastEditAt = timestamp;
        session.firstValidationAfterLastEditAt = null;
        session.firstGraphUpdateAfterEditAt = null;
      }

      if (isValidationCommand(name, args)) {
        session.validationCalls += 1;
        if (session.lastEditAt && timestamp && timestamp >= session.lastEditAt) {
          session.firstValidationAfterLastEditAt ??= timestamp;
        }
      }

      if (GRAPH_UPDATE_RE.test(cmd)) {
        session.graphUpdateCalls += 1;
        if (session.lastEditAt && timestamp && timestamp >= session.lastEditAt) {
          session.firstGraphUpdateAfterEditAt ??= timestamp;
        }
      }
    }
  }

  if (!session.start) {
    const modified = statSync(path).mtime;
    session.start = modified;
    session.end = modified;
  }

  const sixthReadAt = findNthReadTime(path, 6, session.firstEditAt);
  const graphNativeBeforeFirstEdit = !session.firstEditAt || session.firstGraphNativeAt <= session.firstEditAt;
  session.graphNativeBeforeBroadReads = Boolean(
    session.firstGraphNativeAt && graphNativeBeforeFirstEdit && (!sixthReadAt || session.firstGraphNativeAt <= sixthReadAt),
  );
  session.repoSession = shouldIncludeRepoSession(session, repoRoot);
  session.eligible = isEligibleSession(session);
  return session;
}

function findNthReadTime(path, nth, stopAt = null) {
  let count = 0;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
    if (event.type !== "response_item") continue;
    if (payload.type !== "function_call" && payload.type !== "custom_tool_call") continue;
    const timestamp = parseTime(event.timestamp) ?? parseTime(payload.timestamp);
    if (stopAt && (!timestamp || timestamp >= stopAt)) continue;
    const name = String(payload.name ?? payload.tool_name ?? "");
    const args = asObject(payload.arguments ?? payload.input ?? payload.content ?? {});
    if (!isReadCommand(name, args)) continue;
    count += 1;
    if (count === nth) return timestamp;
  }
  return null;
}

function median(values) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[middle - 1] + clean[middle]) / 2 : clean[middle];
}

function rate(count, total) {
  return total > 0 ? count / total : null;
}

function secondsBetween(start, end) {
  if (!start || !end) return null;
  return Math.max(0, (end.getTime() - start.getTime()) / 1000);
}

function safeExec(command, args, cwd) {
  try {
    return {
      ok: true,
      stdout: execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(),
      stderr: "",
    };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout ?? "").trim(),
      stderr: String(error.stderr ?? error.message ?? "").trim(),
    };
  }
}

export function inspectGraphHygiene(repoRoot) {
  const graphPath = join(repoRoot, "graphify-out", "graph.json");
  const reportPath = join(repoRoot, "graphify-out", "GRAPH_REPORT.md");
  const head = safeExec("git", ["rev-parse", "HEAD"], repoRoot);
  const hook = safeExec("graphify", ["hook", "status"], repoRoot);

  let builtFromCommit = null;
  if (existsSync(reportPath)) {
    const report = readFileSync(reportPath, "utf8");
    builtFromCommit = report.match(/Built from commit:\s+`([^`]+)`/)?.[1] ?? null;
  }

  let absoluteSourcePathCount = 0;
  if (existsSync(graphPath)) {
    const graph = readFileSync(graphPath, "utf8");
    absoluteSourcePathCount = (graph.match(/"source_file":\s*"\/Users\//g) ?? []).length;
  }

  const headShort = head.stdout ? head.stdout.slice(0, 8) : null;
  const fresh = Boolean(builtFromCommit && head.stdout && head.stdout.startsWith(builtFromCommit));
  return {
    graphPath: relative(repoRoot, graphPath),
    reportPath: relative(repoRoot, reportPath),
    builtFromCommit,
    head: head.stdout || null,
    headShort,
    fresh,
    absoluteSourcePathCount,
    hookStatusOk: hook.ok,
    hookStatus: hook.ok ? hook.stdout : hook.stderr || hook.stdout,
    healthy: fresh && absoluteSourcePathCount === 0 && hook.ok,
  };
}

function recommendationFor(metrics, graphHygiene) {
  if (!graphHygiene.healthy) {
    return {
      metric: "graph_hygiene",
      severity: "fail",
      target: "fresh graph, zero absolute source paths, hook status succeeds",
      patch:
        "Clean rebuild graphify-out/graph.json from the intended worktree and repair Graphify hook setup before relying on adoption metrics.",
    };
  }

  if ((metrics.graphNativeAdoptionRate ?? 0) < TARGETS.graphNativeAdoptionRate) {
    return {
      metric: "graph_native_adoption",
      severity: "fail",
      target: ">=70% eligible sessions use graphify query/path/explain",
      patch:
        "Tighten AGENTS.md or the primary work skill: before the sixth broad read in eligible cross-module tasks, run graphify query/path/explain and use it to shortlist files.",
    };
  }

  if ((metrics.medianReadsBeforeFirstEdit ?? 0) > TARGETS.medianReadsBeforeFirstEdit) {
    return {
      metric: "median_reads_before_first_edit",
      severity: "warn",
      target: "<=18 reads before first edit",
      patch:
        "Add an exploration budget rule: after one graph query and six raw reads, summarize the target files and make the smallest reversible edit.",
    };
  }

  if ((metrics.medianTimeToFirstEditSeconds ?? 0) > TARGETS.medianTimeToFirstEditSeconds) {
    return {
      metric: "median_time_to_first_edit",
      severity: "warn",
      target: "<=120 seconds to first edit",
      patch:
        "Patch the work workflow to follow graph query -> file shortlist -> first reversible edit for eligible implementation tasks.",
    };
  }

  if ((metrics.verifiedEditRate ?? 0) < TARGETS.verifiedEditRate) {
    return {
      metric: "verified_edit_rate",
      severity: "fail",
      target: ">=80% edit sessions validated after final edit",
      patch:
        "Tighten the verification rule so every edit session runs the narrowest relevant test, lint, build, or Playwright check after the final edit.",
    };
  }

  if ((metrics.graphUpdateComplianceRate ?? 0) < TARGETS.graphUpdateComplianceRate) {
    return {
      metric: "graph_update_compliance",
      severity: "warn",
      target: ">=90% edit sessions run graphify update after edits",
      patch:
        "Patch worktree setup or the work skill to check graphify hook status and run graphify update . after code edits.",
    };
  }

  return {
    metric: "all_targets",
    severity: "pass",
    target: "all current targets met",
    patch: "No instruction patch recommended this cycle; keep measuring.",
  };
}

export function analyzeGraphifyEffectiveness(options = {}) {
  const repoRoot = resolve(options.repo ?? process.cwd());
  const now = options.now ? new Date(options.now) : new Date();
  const start = new Date(now.getTime() - (options.days ?? 14) * 24 * 60 * 60 * 1000);
  const logs = discoverJsonlFiles(options.logs?.length ? options.logs : defaultLogPaths());

  const sessions = logs
    .map((path) => parseSessionFile(path, { repo: repoRoot }))
    .filter((session) => session.end && session.end >= start && session.end <= now)
    .filter((session) => session.repoSession);

  const eligible = sessions.filter((session) => session.eligible);
  const editSessions = sessions.filter((session) => session.editCalls > 0);
  const eligibleEditSessions = eligible.filter((session) => session.editCalls > 0);

  const graphNativeSessions = eligible.filter((session) => session.graphNativeCalls > 0);
  const graphNativeBeforeBroadReadSessions = eligible.filter((session) => session.graphNativeBeforeBroadReads);
  const verifiedEditSessions = editSessions.filter((session) => session.firstValidationAfterLastEditAt);
  const graphUpdatedEditSessions = editSessions.filter((session) => session.firstGraphUpdateAfterEditAt);
  const testsNotRunSessions = editSessions.filter((session) => session.testsNotRunMentions > 0);

  const metrics = {
    totalRepoSessions: sessions.length,
    eligibleSessions: eligible.length,
    editSessions: editSessions.length,
    eligibleEditSessions: eligibleEditSessions.length,
    graphNativeSessions: graphNativeSessions.length,
    graphNativeBeforeBroadReadSessions: graphNativeBeforeBroadReadSessions.length,
    graphNativeAdoptionRate: rate(graphNativeSessions.length, eligible.length),
    graphNativeBeforeBroadReadRate: rate(graphNativeBeforeBroadReadSessions.length, eligible.length),
    medianReadsBeforeFirstEdit: median(eligibleEditSessions.map((session) => session.readCallsBeforeFirstEdit)),
    medianTimeToFirstEditSeconds: median(
      eligibleEditSessions.map((session) => secondsBetween(session.start, session.firstEditAt)),
    ),
    graphUpdateComplianceRate: rate(graphUpdatedEditSessions.length, editSessions.length),
    verifiedEditRate: rate(verifiedEditSessions.length, editSessions.length),
    testsNotRunRate: rate(testsNotRunSessions.length, editSessions.length),
  };

  const graphHygiene = inspectGraphHygiene(repoRoot);
  const recommendation = recommendationFor(metrics, graphHygiene);

  return {
    generatedAt: now.toISOString(),
    window: {
      days: options.days ?? 14,
      start: start.toISOString(),
      end: now.toISOString(),
    },
    targets: TARGETS,
    metrics,
    graphHygiene,
    recommendation,
  };
}

function percent(value) {
  if (value == null) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function number(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return Number(value).toFixed(digits);
}

function statusForMetric(key, value, targets = TARGETS) {
  if (value == null) return "warn";
  if (key === "medianReadsBeforeFirstEdit") return value <= targets.medianReadsBeforeFirstEdit ? "pass" : "fail";
  if (key === "medianTimeToFirstEditSeconds") return value <= targets.medianTimeToFirstEditSeconds ? "pass" : "fail";
  if (key === "graphNativeAdoptionRate") return value >= targets.graphNativeAdoptionRate ? "pass" : "fail";
  if (key === "graphUpdateComplianceRate") return value >= targets.graphUpdateComplianceRate ? "pass" : "fail";
  if (key === "verifiedEditRate") return value >= targets.verifiedEditRate ? "pass" : "fail";
  return "warn";
}

function metricRows(result) {
  const { metrics, targets } = result;
  return [
    {
      label: "Graph-native adoption",
      key: "graphNativeAdoptionRate",
      value: percent(metrics.graphNativeAdoptionRate),
      raw: metrics.graphNativeAdoptionRate,
      target: `>=${percent(targets.graphNativeAdoptionRate)}`,
    },
    {
      label: "Graph before broad reads",
      key: "graphNativeBeforeBroadReadRate",
      value: percent(metrics.graphNativeBeforeBroadReadRate),
      raw: metrics.graphNativeBeforeBroadReadRate,
      target: "higher is better",
    },
    {
      label: "Median reads before first edit",
      key: "medianReadsBeforeFirstEdit",
      value: number(metrics.medianReadsBeforeFirstEdit),
      raw: metrics.medianReadsBeforeFirstEdit,
      target: `<=${targets.medianReadsBeforeFirstEdit}`,
    },
    {
      label: "Median time to first edit",
      key: "medianTimeToFirstEditSeconds",
      value: `${number(metrics.medianTimeToFirstEditSeconds)}s`,
      raw: metrics.medianTimeToFirstEditSeconds,
      target: `<=${targets.medianTimeToFirstEditSeconds}s`,
    },
    {
      label: "Graph update compliance",
      key: "graphUpdateComplianceRate",
      value: percent(metrics.graphUpdateComplianceRate),
      raw: metrics.graphUpdateComplianceRate,
      target: `>=${percent(targets.graphUpdateComplianceRate)}`,
    },
    {
      label: "Verified edit rate",
      key: "verifiedEditRate",
      value: percent(metrics.verifiedEditRate),
      raw: metrics.verifiedEditRate,
      target: `>=${percent(targets.verifiedEditRate)}`,
    },
    {
      label: "Tests-not-run rate",
      key: "testsNotRunRate",
      value: percent(metrics.testsNotRunRate),
      raw: metrics.testsNotRunRate,
      target: "lower is better",
    },
  ].map((row) => ({ ...row, status: statusForMetric(row.key, row.raw, targets) }));
}

export function renderText(result) {
  const rows = metricRows(result);
  const lines = [
    "Graphify Effectiveness",
    `Window: ${result.window.start} -> ${result.window.end}`,
    `Repo sessions: ${result.metrics.totalRepoSessions}; eligible: ${result.metrics.eligibleSessions}; edit sessions: ${result.metrics.editSessions}`,
    "",
    "Metrics:",
  ];
  for (const row of rows) {
    lines.push(`- ${row.label}: ${row.value} (target ${row.target}) [${row.status}]`);
  }
  lines.push("");
  lines.push("Graph hygiene:");
  lines.push(`- builtFromCommit: ${result.graphHygiene.builtFromCommit ?? "n/a"}`);
  lines.push(`- head: ${result.graphHygiene.headShort ?? "n/a"}`);
  lines.push(`- absoluteSourcePathCount: ${result.graphHygiene.absoluteSourcePathCount}`);
  lines.push(`- hookStatusOk: ${result.graphHygiene.hookStatusOk}`);
  lines.push("");
  lines.push("Recommended patch:");
  lines.push(`- ${result.recommendation.metric}: ${result.recommendation.patch}`);
  return `${lines.join("\n")}\n`;
}

export function renderMarkdown(result) {
  const rows = metricRows(result)
    .map((row) => `| ${row.label} | ${row.value} | ${row.target} | ${row.status} |`)
    .join("\n");
  return `# Graphify Effectiveness

Window: ${result.window.start} -> ${result.window.end}

Repo sessions: ${result.metrics.totalRepoSessions}; eligible: ${result.metrics.eligibleSessions}; edit sessions: ${result.metrics.editSessions}

| Metric | Current | Target | Status |
|---|---:|---:|---|
${rows}

## Graph Hygiene

- Built from commit: ${result.graphHygiene.builtFromCommit ?? "n/a"}
- Current HEAD: ${result.graphHygiene.headShort ?? "n/a"}
- Absolute source paths: ${result.graphHygiene.absoluteSourcePathCount}
- Hook status ok: ${result.graphHygiene.hookStatusOk}

## Recommended Patch

${result.recommendation.patch}
`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderHtml(result) {
  const rows = metricRows(result)
    .map(
      (row) => `<tr data-status="${row.status}"><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td><td>${escapeHtml(row.target)}</td><td>${escapeHtml(row.status)}</td></tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Graphify Effectiveness</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #17202a; background: #fbfcfd; }
    main { max-width: 960px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { border: 1px solid #d8dee4; padding: 10px 12px; text-align: left; }
    th { font-weight: 650; }
    [data-status="pass"] td:last-child { color: #116329; font-weight: 700; }
    [data-status="warn"] td:last-child { color: #7a4d00; font-weight: 700; }
    [data-status="fail"] td:last-child { color: #a40e26; font-weight: 700; }
    section { margin-top: 28px; }
    code { background: #eef2f6; padding: 2px 5px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Graphify Effectiveness</h1>
    <p>Last analyzed: <time>${escapeHtml(result.generatedAt)}</time></p>
    <p>Window: ${escapeHtml(result.window.start)} to ${escapeHtml(result.window.end)}</p>
    <p>Repo sessions: ${result.metrics.totalRepoSessions}; eligible: ${result.metrics.eligibleSessions}; edit sessions: ${result.metrics.editSessions}</p>

    <section>
      <h2>Metrics</h2>
      <table>
        <thead><tr><th>Metric</th><th>Current</th><th>Target</th><th>Status</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Graph Hygiene</h2>
      <ul>
        <li>Built from commit: <code>${escapeHtml(result.graphHygiene.builtFromCommit ?? "n/a")}</code></li>
        <li>Current HEAD: <code>${escapeHtml(result.graphHygiene.headShort ?? "n/a")}</code></li>
        <li>Absolute source paths: ${result.graphHygiene.absoluteSourcePathCount}</li>
        <li>Hook status ok: ${result.graphHygiene.hookStatusOk}</li>
      </ul>
    </section>

    <section>
      <h2>Recommended patch</h2>
      <p>${escapeHtml(result.recommendation.patch)}</p>
    </section>
  </main>
</body>
</html>
`;
}

export function renderResult(result, format) {
  if (format === "json") return `${JSON.stringify(result, null, 2)}\n`;
  if (format === "markdown") return renderMarkdown(result);
  if (format === "html") return renderHtml(result);
  return renderText(result);
}

function printHelp() {
  process.stdout.write(`Usage: node scripts/measure-graphify-effectiveness.mjs [options]

Options:
  --days N              Analyze the last N days (default 14)
  --format F           text, json, markdown, or html (default text)
  --out PATH           Write output to PATH instead of stdout
  --repo PATH          Repository root (default cwd)
  --logs PATH          Log directory or JSONL file (repeatable)
`);
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  const result = analyzeGraphifyEffectiveness(args);
  const rendered = renderResult(result, args.format);
  if (args.out) {
    const outPath = resolve(args.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, rendered, "utf8");
  } else {
    process.stdout.write(rendered);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);
if (invokedPath === modulePath) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
