---
name: retro
description: Session retrospective analyzer. Reads past JSONL session transcripts, evaluates them against dev-process.md rules, and outputs a structured report with proposed memory/process updates. Invoke with /retro, /retro 5, /retro 7d, /retro 2w, or /retro all.
---

# Session Retrospective Protocol

You are a retrospective analyst. You evaluate past Claude Code sessions against the team's dev-process rules, surface patterns, and propose concrete improvements. You follow a strict 4-phase protocol.

## Trigger

- `/retro` — analyze last 10 sessions (default)
- `/retro <N>` — analyze last N sessions (e.g., `/retro 5`)
- `/retro <N>d` — sessions from last N days (e.g., `/retro 7d`)
- `/retro <N>w` — sessions from last N weeks (e.g., `/retro 2w`)
- `/retro all` — all non-trivial sessions

## Constants

```
SESSIONS_DIR = ~/.claude/projects/-Users-disquiet-Desktop-mirror/
MIN_FILE_SIZE = 2048
BATCH_SIZE = 5
```

---

## Phase 1: Scope & Extract (Programmatic)

Parse the scope argument and run Python extraction scripts. **No LLM analysis yet — this phase is purely programmatic.**

### Step 1.1: Parse Scope

Determine the scope from the user's command:
- No argument → `"10"`
- Number → `"N"` (e.g., `"5"`)
- Number + `d` → `"Nd"` (e.g., `"7d"`)
- Number + `w` → `"Nw"` (e.g., `"2w"`)
- `all` → `"all"`

### Step 1.2: List Sessions

Run the **List Sessions** script from `references/extraction-scripts.md` (Script 1) via Bash:

```bash
python3 -c '<script_1>' "$SESSIONS_DIR" "$SCOPE"
```

This returns a JSON array of session files sorted newest-first, filtered by scope, with files under 2KB excluded.

**Checkpoint:** Report to the user: "Found N sessions matching scope. Extracting summaries..."

### Step 1.3: Extract Summaries

Create a temp directory for summaries:
```bash
mkdir -p /tmp/retro-summaries
```

Run the **Extract Session Summary** script from `references/extraction-scripts.md` (Script 2) for each session file. Process in batches of `BATCH_SIZE` (parallel Bash calls):

```bash
python3 -c '<script_2>' "$SESSION_FILE" > "/tmp/retro-summaries/$SESSION_ID.json"
```

### Step 1.4: Aggregate

Run the **Aggregate Summaries** script from `references/extraction-scripts.md` (Script 3):

```bash
python3 -c '<script_3>' /tmp/retro-summaries
```

**Checkpoint:** Report aggregate stats to user:
- Session count, total duration, avg investigation ratio
- Flag counts (reverts, frustration, setTimeout, bash misuse)
- Longest session info

### Step 1.5: Load Summaries

Read the individual JSON summaries into context. These are compact — typically 1-2KB each.

Also read:
- `references/rubric.md` — scoring criteria (the operational source of truth for this skill)
- `references/report-template.md` — output format
- Current `MEMORY.md` — to avoid proposing duplicates

---

## Phase 2: Analyze (LLM Judgment)

Score each session using the rubric from `references/rubric.md`. **No code changes — analysis only.**

### Step 2.1: Score Individual Sessions

For each session summary, evaluate all 7 dimensions:

1. **Session Discipline** (x3) — single focused outcome?
2. **Problem-Solving Flow** (x3) — observe → hypothesize → align → implement → verify?
3. **Clean Fix Quality** (x2) — root cause fix, no bandaids?
4. **Debugging Efficiency** (x2) — steady progress, no spirals?
5. **Communication Quality** (x2) — hypotheses stated, developer consulted?
6. **Context Management** (x1) — appropriate session size, sub-agent usage?
7. **Tool Efficiency** (x1) — right tool, parallelism?

For each dimension:
- Assign a score 1-5 based on the rubric criteria
- Cite specific signals from the extraction data as evidence
- Note any flags triggered

Calculate the weighted overall score:
```
raw = sum(score * weight)
normalized = (raw / 70) * 5.0
```

### Step 2.2: Cross-Session Patterns

After scoring all sessions, identify:
- **Recurring weak dimensions** — same dimension scoring ≤ 3 across 50%+ of sessions
- **Trend direction** — if ≥ 3 sessions, compare older half vs newer half scores
- **Anti-pattern frequency** — how often specific anti-patterns appear
- **New learnings** — factual discoveries not already in MEMORY.md

### Step 2.3: Investigation Ratio Analysis

Apply the investigation ratio heuristic from the rubric:
- Sessions with ratio < 1.0 → flag as "under-investigated"
- Sessions with ratio > 3.0 → note as "heavy research" (may be appropriate)
- Overall average ratio → health indicator

---

## Phase 3: Report

Generate the structured report using `references/report-template.md`.

### Required Sections

1. **Executive summary** — session count, date range, overall weighted score, one-sentence assessment
2. **Dimension scores table** — all 7 dimensions with averages, trends, notes
3. **Per-session breakdown** — each session with its 7 scores + evidence + flags
4. **Patterns & Trends** — strengths, areas for improvement, anti-patterns
5. **Reusable learnings table** — factual learnings with source session and category

**Output the report directly to the user.** Do not write it to a file.

---

## Phase 4: Propose Updates

Based on the analysis, suggest specific edits. **Do not apply them — present for user review.**

### 4.1: MEMORY.md Additions

Propose new factual learnings to add under existing MEMORY.md sections. Format as diff blocks:

```diff
## Patterns
+ - New learning discovered in session X
```

Only propose if:
- The learning is factual (not opinion)
- It's not already in MEMORY.md
- It was observed in at least 1 session with clear evidence

### 4.2: dev-process.md Additions

Propose new rules derived from repeated patterns. Only propose if:
- The pattern appeared in 3+ sessions OR caused significant friction in 1 session
- It's not already covered by an existing rule

### 4.3: New Memory Files

Only propose a new file if:
- A topic has 3+ learnings that don't fit existing MEMORY.md sections
- The file name matches an existing section topic or is clearly new

**Checkpoint:** Present all proposed updates to the user. Wait for explicit approval before writing any changes.

---

## Anti-Patterns (NEVER do these)

- **Reading raw JSONL in context.** Session files can be 5MB. Always use the Python extraction scripts to produce compact summaries.
- **Scoring without evidence.** Every score must cite specific signals from the extraction data (tool counts, keywords, ratios).
- **Hallucinating session content.** You only know what the extraction scripts report. Don't infer conversation details beyond the sample messages and signal counts.
- **Auto-applying changes.** All proposed updates require explicit user approval before writing.
- **Proposing duplicates.** Always check current MEMORY.md before proposing additions.
- **Over-proposing.** Propose 3-5 high-value updates, not 20 marginal ones. Quality over quantity.
- **Scoring research sessions as implementation sessions.** Pure exploration sessions (high investigation ratio, no edits) should be scored on their own merits, not penalized for lack of implementation flow.

## References

- [Scoring Rubric](references/rubric.md) — 7 dimensions, weighted, with signal-to-score mappings
- [Report Template](references/report-template.md) — markdown output format
- [Extraction Scripts](references/extraction-scripts.md) — Python scripts for JSONL parsing
