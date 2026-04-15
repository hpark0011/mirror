# chat-backend-developer — Session Logs

*Last updated: 2026-04-14*

Append-only. One entry per task, newest at bottom. Format and rules live in the agent spec → **How to Operate** (step 5: Log & Patch) and **Evidence Rule**. Do not duplicate them here.

---

## 2026-04-14 — Initial inspection of chat layer (fix-chat-message-system branch)

**Task**: Read-only inspection + structured report on the Convex chat agent layer.

**Reuse audit**: knowledge.md was empty (first-session baseline). No prior logs. Read every file in `packages/convex/convex/chat/` plus `apps/mirror/features/chat/hooks/use-chat.ts`.

**Bottleneck**: No pre-existing knowledge file. Every architectural fact had to be derived from source. For a first session this is expected; subsequent sessions should skip the full read pass.

**Counterfactual**: If `knowledge.md` had already contained the architecture + data-flow contracts written this session, the report could have been produced in 1-2 targeted reads (only the specific area the user asked about) instead of a full sweep. Estimated savings ~60% of read volume.

**Patch**: Populated `.claude/agent-memory/chat-backend-developer/knowledge.md` with file map, `conversations` schema, full `sendMessage` / `retryMessage` / `streamResponse` pipelines with file:line anchors, `composeSystemPrompt` section-order contract, rate-limit table, access-control matrix, and gotchas (fencing-token lock, RAG best-effort, retry-without-userMessage amplification, no stuck-lock reaper, public query omits `streamingStartedAt`).

**Observed rough edges** (high-signal starting points for the fix-chat-message-system work):
1. `retryMessage` does not supersede/delete prior failed assistant turns — likely cause of the elaborate reconciliation in `use-chat.ts` (baselines + `shouldSuppressEmptyNewAssistant`).
2. `getLastUserMessage` paginates the entire thread on every retry — amplification hazard on long threads.
3. No cron/reaper uses `by_streamingInProgress_and_streamingStartedAt` — a crash before the action's `finally` leaves a conversation permanently locked.
