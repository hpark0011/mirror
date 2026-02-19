---
title: "File Organization Consistency: Components vs Views"
type: research-report
date: 2026-02-19
status: actionable
---

# File Organization Consistency: Components vs Views

## The Inconsistency

Two sibling toolbar view files in `apps/mirror/features/articles/` live in different directories:

| File | Directory | Reads Context? | Pure? |
|------|-----------|----------------|-------|
| `article-toolbar-view.tsx` | `components/` | Yes (`useArticleToolbar()`) | No |
| `article-detail-toolbar-view.tsx` | `views/` | No (props only) | Yes |

Both have the `-view` suffix, but one lives in `components/` and the other in `views/`. This signals a systemic problem.

---

## Root Cause Analysis

### Timeline

| Date | Event |
|------|-------|
| **2026-02-09** | File organization convention created (`docs/conventions/file-organization-convention.md`). Lists `views/` as a valid feature subfolder but does **not define** what goes in `views/` vs `components/`. |
| **2026-02-12** | PR #121: Both files created by Claude Opus 4.6 in `views/`. Agent used filename pattern-matching (`-view` suffix → `views/` directory) instead of behavioral analysis (reads context vs pure props). |
| **2026-02-13** | PR #121 code review: `ArticleToolbarView` correctly identified as violating "views are pure" convention. Moved to `components/` but **not renamed**. Todo #175 suggested renaming to `article-toolbar-connector.tsx` but this was not executed. |
| **2026-02-13** | `articles.md` rules file created, documenting the **post-move** state. Invented the term "_View Components_" to describe context-reading wrappers in `components/`, rationalizing the inconsistency instead of flagging the remaining naming issue. |

### The Three Cascading Failures

1. **Missing definition in the canonical convention doc** (primary). The convention establishes that `views/` and `components/` are both valid subdirectories but never defines the semantic boundary between them. An agent creating a new file had no rule to consult.

2. **Incomplete code review fix** (secondary). The file was moved from `views/` to `components/` but not renamed. A `-view` suffixed file now lives in `components/`, confusing in the opposite direction.

3. **Post-hoc documentation codified the inconsistency** (tertiary). The `articles.md` rules file described the current state as a pattern ("_View Components_") rather than flagging the remaining naming issue.

### Similar Issues Found Elsewhere

| File | Location | Pure? | Issue |
|------|----------|-------|-------|
| `video-call-view.tsx` | `video-call/components/` | No (calls hooks) | `-view` name in `components/`, no `views/` dir exists |
| `board-view.tsx` | `kanban-board/components/` | Yes | Pure but in `components/` with `-view` suffix (Greyboard has no `views/` concept) |
| `list-view.tsx` | `task-list/components/` | Yes | Same as `board-view.tsx` |
| `delete-articles-dialog.tsx` | `articles/views/` | N/A | A dialog in `views/` — arguably should be in `components/` |

---

## Convention Audit

### What the Docs Say

**`docs/conventions/file-organization-convention.md`**: Lists both `components/` and `views/` as valid feature subdirectories. No placement criteria — just the directory names in a folder structure example.

**`.claude/rules/folder-structure.md`**: Defers entirely to the convention doc. Mentions `features/<feature>/{components,hooks,store,types,utils,lib,views}/` without distinguishing them.

**`.claude/rules/apps/mirror/articles.md`**: The only file that defines the boundary: "Views are pure UI components that receive all state as props." But this is scoped to `apps/mirror/features/articles/**` via path matching — invisible to other features.

### What the Codebase Actually Does

**Mirror**: Uses both `components/` and `views/` in features. The boundary is mostly respected (views are pure) but leaky — context-reading files with `-view` suffixes live in `components/`.

**Greyboard**: No `views/` concept. All feature UI lives in `components/`. Files with `-view` suffixes happily coexist there. Convention is internally consistent.

**packages/features/auth**: Uses `views/` as a package API layer (pure UI that consumers can customize) vs `components/forms` (pre-wired integrations). This distinction serves a real architectural purpose.

### The Gap

The canonical convention document does not define:
1. What goes in `views/` vs `components/`
2. Whether `-view` suffixed files must live in `views/`
3. Whether cross-app conventions should be consistent

---

## Industry Best Practices Assessment

### Does the `components/` + `views/` split follow best practices?

**Short answer: No, for app-level features. Yes, for shared package APIs.**

| Source | Recommendation |
|--------|---------------|
| **Bulletproof React** | Single `components/` per feature. No `views/` directory. |
| **Feature-Sliced Design** | Neither — uses `ui/` for all visual code. Advises against type-based segment names. |
| **Turborepo docs** | Agnostic on feature internals. Focuses on package boundaries. |
| **Next.js** | No guidance on feature-internal organization. |
| **Community consensus (2025-2026)** | Feature-based org with single `components/` directory. Hooks provide logic/UI separation, making a separate `views/` dir redundant. |

### AI-Agent-Specific Considerations

This codebase extensively uses AI coding agents via git worktrees. Research from Martin Fowler, Addy Osmani, and JetBrains on coding agent guidelines identifies three principles:

1. **Mechanical rules over conceptual rules.** Agents excel at "files with suffix X go in directory Y" but struggle with "is this a view or a component?" — a judgment call that varies per developer.

2. **Fewer directories = fewer wrong answers.** Two directories (`components/` + `views/`) = binary decision per file. One directory = zero decisions = zero misplacements.

3. **Reference patterns beat abstract rules.** Pointing agents at exemplary files works better than paragraphs explaining placement criteria.

### The Core Problem for AI Agents

The `components/` vs `views/` boundary requires understanding the team's philosophical distinction between "connected" and "presentational" components. This is exactly the type of conceptual rule that AI agents consistently get wrong. The evidence from this codebase confirms it: the same agent (Claude) created both files in the same PR and placed them both in `views/`, applying filename pattern-matching instead of behavioral analysis.

---

## Recommendation

### For app-level features: Merge `views/` into `components/`

**Rationale:**
- The boundary is already leaky (multiple misplaced files across features)
- Industry consensus favors a single `components/` directory per feature
- Hooks already provide logic/UI separation — `views/` is a redundant second encoding
- Greyboard already works this way successfully
- Eliminates the binary placement decision that AI agents get wrong

**What to do instead:** Use a single `components/` directory. Optionally use a `-view` filename suffix for pure-presentational components (e.g., `components/article-list-view.tsx`). This gives a human-readable signal without creating a separate directory.

### For cross-app packages: Keep `views/` as a package API layer

In `packages/features/auth/`, the `views/` directory represents a real API contract: the customizable pure-UI layer vs the pre-wired forms layer. This is a legitimate architectural boundary that should be preserved.

### Decision matrix after merging

| File type | Where it goes |
|-----------|--------------|
| React component (any kind) | `features/<feature>/components/` |
| Custom hook | `features/<feature>/hooks/` |
| Context provider | `features/<feature>/context/` |
| Types/interfaces | `features/<feature>/types/` or co-located |
| Utility functions | `features/<feature>/utils/` |
| Adapters/schemas/data | `features/<feature>/lib/` |
| Stores (Zustand, etc.) | `features/<feature>/store/` |

Zero ambiguity. Every AI agent places files correctly because there is exactly one answer per file type.

---

## Action Items

### Immediate (This Session)

- [ ] **Rename `article-toolbar-view.tsx` → `article-toolbar-connector.tsx`** in `components/` to remove the misleading `-view` suffix. Update imports. This completes the fix that Todo #175 started but didn't finish.
- [ ] **Move `delete-articles-dialog.tsx`** from `views/` to `components/`. It's a dialog, not a pure presentational view.

### Convention Updates (Next Session)

- [ ] **Update `docs/conventions/file-organization-convention.md`**: Add explicit guidance that app-level features should use a single `components/` directory. Remove `views/` from the app-level feature template. Note that `views/` is appropriate for cross-app packages where it represents a package API layer.
- [ ] **Update `.claude/rules/folder-structure.md`**: Stop deferring entirely to the convention doc. Inline the key rule: "App-level features use `components/` for all React components. `views/` is reserved for shared packages where it defines a package API boundary."
- [ ] **Update `.claude/rules/apps/mirror/articles.md`**: Remove the "_View Components_" terminology. Update the component organization section to reflect the merged `components/` directory. Document the `-view` suffix as a naming signal for pure-presentational components, not a directory requirement.

### Migration (Separate PR)

- [ ] **Merge `views/` into `components/`** across all Mirror features. Move files, update imports. Features to audit:
  - `features/articles/views/` → merge into `features/articles/components/`
  - `features/profile/views/` → merge into `features/profile/components/`
  - `features/home/views/` → merge into `features/home/components/`
  - Any other features with `views/` directories
- [ ] **Reconcile Greyboard and Mirror conventions**: Greyboard already uses `components/` only — no changes needed there. Document that the unified convention now matches Greyboard's existing pattern.

### System Patches (Prevent Recurrence)

- [ ] **Add a naming convention rule**: Files with `-view` suffix are pure-presentational. Files with `-connector` or `-container` suffix read context/hooks and pass to underlying components. This is a naming signal, not a directory requirement.
- [ ] **Add a placement decision tree to the convention doc** for AI agents: "Is it a React component? → `components/`. Is it a hook? → `hooks/`. Is it a context? → `context/`." Zero decisions.
- [ ] **Add a code review checklist item**: "Do any new files have mismatched name-suffix and directory placement?"

---

## Sources

### Internal
- `docs/conventions/file-organization-convention.md`
- `.claude/rules/folder-structure.md`
- `.claude/rules/apps/mirror/articles.md`
- `todos/completed/175-completed-p2-article-toolbar-view-naming.md`
- `todos/completed/084-completed-p2-views-naming-convention-violation.md`
- `todos/completed/052-completed-p3-views-vs-view-directory-naming.md`
- `docs/plans/completed/2026-02-09-feat-file-organization-convention-plan.md`

### External
- [Bulletproof React - Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
- [Feature-Sliced Design - Segments](https://feature-sliced.design/docs/reference/slices-segments)
- [Martin Fowler - Context Engineering for Coding Agents](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html)
- [Addy Osmani - My LLM Coding Workflow Going into 2026](https://addyosmani.com/blog/ai-coding-workflow/)
- [JetBrains - Coding Guidelines for Your AI Agents](https://blog.jetbrains.com/idea/2025/05/coding-guidelines-for-your-ai-agents/)
- [profy.dev - React Folder Structures and Screaming Architecture](https://profy.dev/article/react-folder-structure)
- [patterns.dev - Container/Presentational Pattern](https://www.patterns.dev/react/presentational-container-pattern/)
