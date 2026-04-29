---
topic: {{topic}}
date: {{YYYY-MM-DD}}
scope: {{one-line scope}}
status: draft | final
---

# Research: {{topic}}

## Brief

- **Topic**: {{what we set out to research}}
- **Context**: {{why the user wanted this}}
- **Scope**: {{what's in / what's out}}

## Executive summary

3–5 bullets. The things a reader who only reads this section must know: top patterns, biggest gap in current codebase, recommended next step.

## Synthesis — best practices

### Ranked patterns

1. **{{pattern name}}** — evidence: {{strong|medium|weak}}
   - **What**: 1–2 sentence description.
   - **Trade-offs**: what it optimizes for, what it sacrifices.
   - **Sources**: [source 1](url), [source 2](url), [source 3](url).
2. …

### Cross-lane disagreements

| Topic | Official docs say | OSS projects do | Practitioners report | Research papers say | Interpretation |
| ----- | ----------------- | --------------- | -------------------- | ------------------- | -------------- |
|       |                   |                 |                      |                     |                |

### Anti-patterns to avoid

- **{{anti-pattern}}** — why it fails. Sources: [...](url).

## Codebase today

### Presence

- **Status**: Fully implemented / Partially implemented / Absent.
- **Owning surface**: {{app/package}}.

### Current implementation

- `path/to/file.ts:L42` — what it does.
- …

### Conventions already in use

- {{convention}} — enforced by {{rule file}}.

## Gap analysis

### Alignment (already matches best practice)

| Pattern | Where in codebase | Notes |
| ------- | ----------------- | ----- |
|         |                   |       |

### Divergences

| Gap | What we do | Best practice | Justified? | Impact |
| --- | ---------- | ------------- | ---------- | ------ |
|     |            |               |            | L/M/H  |

### Absences

| Missing pattern | Closest adjacent code | Impact |
| --------------- | --------------------- | ------ |
|                 |                       | L/M/H  |

## Recommended next step

One sentence. Usually:

- **Hand off to `create-spec`** — if gaps are non-trivial and a spec is needed before implementation.
- **Close the research** — if the codebase already matches best practice.
- **Request clarification** — if the research surfaced a decision the user must make before speccing.

## Appendix

### Source index

| # | Source | Lane | Date | Link |
| - | ------ | ---- | ---- | ---- |
| 1 |        | OSS / Official / Social / Paper (peer-reviewed / preprint) | YYYY-MM-DD | url |

### Out of scope but interesting

- {{tangent}} — why it didn't make the synthesis.

### Open questions

- {{question}} — who/what could answer it.
