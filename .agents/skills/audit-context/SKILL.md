---
name: config-audit
description: >
  Audit Codex configuration files (AGENTS.md, AGENTS.md, .Codex/rules/,
  .Codex/skills/) against actual codebase patterns. Identifies stale rules,
  missing conventions, contradictions, and instruction budget issues. Use when
  the user says "check my config", "audit rules", "review instructions",
  "are my rules correct", or "clean up AGENTS.md".
disable-model-invocation: true
---

## Audit Procedure

1. Read all config files: AGENTS.md, AGENTS.md, .Codex/rules/**/*.md, .Codex/skills/*/SKILL.md, .Codex/agents/*
2. Scan codebase for actual patterns (grep for imports, conventions, file structure)
3. Compare rules against reality:
   - Rules referencing patterns no longer in the codebase → flag for removal
   - Repeated corrections in recent git history (reverted AI-generated code) not captured → flag for addition
   - Overlapping or contradicting rules → flag for merge
   - AGENTS.md content scoped to specific paths → flag for extraction to rules/
   - Rules that are descriptive rather than action-guiding (mostly prose, no checklist, no imperatives) → flag for move to docs/
   - Docs that contain imperatives ("do X", "check Y first", "always Z") → flag for promotion to rules/ with `paths:` scoping
   - Single canonical rationale violations: same principle restated in multiple files → flag the duplication, keep the canonical source (usually a doc), replace the others with pointers

   **Placement test**: would reading this change the code an agent writes right now? Yes → rule. No → doc. Default to docs when unsure — rules tax context on every relevant turn; docs cost zero unless linked.
4. Audit AGENTS.md / AGENTS.md against the lean-index philosophy:

   > Separation of concerns with a single source of truth for context. AGENTS.md is a lean index, not a container. Only what needs active context every turn lives there — everything else (rules, docs, agents, skills) is organized elsewhere and referenced on demand. Like a good codebase: minimal entry point, delegate to well-organized modules.

   Section-by-section checks:
   - For each `##` section, ask: would removing this change the code an agent writes on a typical turn? No → extract to a rule (action-guiding) or doc (descriptive), leave a one-line pointer.
   - Multi-step procedures, reference tables, long examples, or descriptive prose beyond a one-paragraph orientation → not index material; extract.
   - Content restated from a rule or doc → replace with pointer (single source of truth).
   - Multiple short pointer sections each with their own `##` header (4+) → collapse into a single index section (e.g., `## Project Rules`).
   - Hard heuristic: AGENTS.md over ~200 lines is almost always a container, not an index. Long AGENTS.md is a smell, not a feature.

5. Check rule budget:
   - Are there rules without `paths:` targeting that should have it? (Untargeted rules tax every turn.)
   - Are there rules Codex follows correctly without being told? (Often: generic best practices that aren't repo-specific — drop them.)

6. Propose changes as a concrete diff. Don't apply without confirmation.
