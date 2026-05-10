import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  analyzeGraphifyEffectiveness,
  parseSessionFile,
  renderHtml,
} from "./measure-graphify-effectiveness.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const fixtures = join(root, "__fixtures__", "graphify-effectiveness");

function writeSession(t, events) {
  const dir = mkdtempSync(join(tmpdir(), "graphify-effectiveness-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "session.jsonl");
  writeFileSync(path, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
  return path;
}

function turnContext(timestamp) {
  return {
    timestamp,
    type: "turn_context",
    payload: {
      cwd: "/tmp/repo/mirror",
      user_instructions: "# Feel Good Monorepo\nThis project has a graphify knowledge graph at graphify-out/.",
    },
  };
}

function userMessage(timestamp, text) {
  return {
    timestamp,
    type: "response_item",
    payload: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text }],
    },
  };
}

function toolCall(timestamp, name, args) {
  return {
    timestamp,
    type: "response_item",
    payload: {
      type: "function_call",
      name,
      arguments: JSON.stringify(args),
      call_id: `call_${timestamp.replace(/\W/g, "_")}`,
    },
  };
}

test("parses graph-native usage before broad reads", () => {
  const session = parseSessionFile(join(fixtures, "graph-native-edit.jsonl"), {
    repo: "/tmp/repo/mirror",
  });

  assert.equal(session.repoSession, true);
  assert.equal(session.eligible, true);
  assert.equal(session.graphNativeCalls, 1);
  assert.equal(session.graphNativeBeforeBroadReads, true);
  assert.equal(session.readCallsBeforeFirstEdit, 1);
  assert.equal(session.firstGraphUpdateAfterEditAt instanceof Date, true);
  assert.equal(session.firstValidationAfterLastEditAt instanceof Date, true);
});

test("aggregates effectiveness metrics from JSONL fixtures", () => {
  const result = analyzeGraphifyEffectiveness({
    repo: "/tmp/repo/mirror",
    logs: [fixtures],
    days: 10,
    now: "2026-05-03T00:00:00.000Z",
  });

  assert.equal(result.metrics.totalRepoSessions, 2);
  assert.equal(result.metrics.eligibleSessions, 2);
  assert.equal(result.metrics.editSessions, 2);
  assert.equal(result.metrics.graphNativeSessions, 1);
  assert.equal(result.metrics.graphNativeAdoptionRate, 0.5);
  assert.equal(result.metrics.medianReadsBeforeFirstEdit, 3.5);
  assert.equal(result.metrics.graphUpdateComplianceRate, 0.5);
  assert.equal(result.metrics.verifiedEditRate, 0.5);
  assert.equal(result.metrics.testsNotRunRate, 0.5);
});

test("counts repo-standard read and validation commands", (t) => {
  const sessionPath = writeSession(t, [
    turnContext("2026-05-02T00:00:00.000Z"),
    userMessage("2026-05-02T00:00:01.000Z", "Implement a cross-module measurement fix."),
    toolCall("2026-05-02T00:00:02.000Z", "exec_command", {
      cmd: "fd auth apps/mirror",
      metadata: {
        paths: ["packages/convex/convex/schema.ts"],
      },
    }),
    toolCall("2026-05-02T00:00:03.000Z", "apply_patch", {
      patch: [
        "*** Begin Patch",
        "*** Update File: apps/mirror/lib/auth.ts",
        "@@",
        "-const value = false;",
        "+const value = true;",
        "*** End Patch",
      ].join("\n"),
    }),
    toolCall("2026-05-02T00:00:04.000Z", "exec_command", {
      cmd: "graphify update .",
    }),
    toolCall("2026-05-02T00:00:05.000Z", "apply_patch", {
      patch: [
        "*** Begin Patch",
        "*** Update File: packages/convex/convex/schema.ts",
        "@@",
        "-const value = false;",
        "+const value = true;",
        "*** End Patch",
      ].join("\n"),
    }),
    toolCall("2026-05-02T00:00:06.000Z", "exec_command", {
      cmd: "pnpm --filter=@feel-good/mirror test:e2e",
    }),
    toolCall("2026-05-02T00:00:07.000Z", "exec_command", {
      cmd: "node --test scripts/measure-graphify-effectiveness.test.mjs",
    }),
  ]);

  const session = parseSessionFile(sessionPath, { repo: "/tmp/repo/mirror" });

  assert.equal(session.readCalls, 1);
  assert.equal(session.validationCalls, 2);
  assert.equal(session.touchedAreas.has("apps"), true);
  assert.equal(session.touchedAreas.has("packages"), true);
  assert.equal(session.firstGraphUpdateAfterEditAt, null);
  assert.equal(session.firstValidationAfterLastEditAt instanceof Date, true);
});

test("does not count graph-native usage after the first edit as pre-spelunking", (t) => {
  const sessionPath = writeSession(t, [
    turnContext("2026-05-02T01:00:00.000Z"),
    userMessage("2026-05-02T01:00:01.000Z", "Investigate and fix a cross-module route bug."),
    toolCall("2026-05-02T01:00:02.000Z", "exec_command", { cmd: "cat apps/mirror/app/a.ts" }),
    toolCall("2026-05-02T01:00:03.000Z", "exec_command", { cmd: "rg route apps packages" }),
    toolCall("2026-05-02T01:00:04.000Z", "exec_command", { cmd: "ls apps/mirror" }),
    toolCall("2026-05-02T01:00:05.000Z", "exec_command", { cmd: "sed -n '1,80p' packages/convex/a.ts" }),
    toolCall("2026-05-02T01:00:06.000Z", "exec_command", { cmd: "nl -ba packages/convex/b.ts" }),
    toolCall("2026-05-02T01:00:07.000Z", "apply_patch", {
      patch: [
        "*** Begin Patch",
        "*** Update File: packages/convex/convex/routes.ts",
        "@@",
        "-const route = null;",
        "+const route = 'fixed';",
        "*** End Patch",
      ].join("\n"),
    }),
    toolCall("2026-05-02T01:00:08.000Z", "exec_command", {
      cmd: "graphify query \"how does mirror route relate to convex\"",
    }),
    toolCall("2026-05-02T01:00:09.000Z", "exec_command", {
      cmd: "find apps/mirror -name '*.ts'",
    }),
  ]);

  const session = parseSessionFile(sessionPath, { repo: "/tmp/repo/mirror" });

  assert.equal(session.graphNativeCalls, 1);
  assert.equal(session.readCallsBeforeFirstEdit, 5);
  assert.equal(session.graphNativeBeforeBroadReads, false);
});

test("renders deterministic HTML without invalid numeric sentinels", () => {
  const result = analyzeGraphifyEffectiveness({
    repo: "/tmp/repo/mirror",
    logs: [fixtures],
    days: 10,
    now: "2026-05-03T00:00:00.000Z",
  });
  const html = renderHtml(result);

  assert.match(html, /Graphify Effectiveness/);
  assert.match(html, /Median reads before first edit/);
  assert.doesNotMatch(html, /NaN|undefined|Infinity/);
  assert.match(html, /data-status="(?:pass|warn|fail)"/);
});
