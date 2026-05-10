import assert from "node:assert/strict";
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
