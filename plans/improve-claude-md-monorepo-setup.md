# Improve CLAUDE.md Monorepo Setup

## Overview

Assessment and improvement plan for CLAUDE.md configuration in the feel-good monorepo to follow Claude Code best practices.

---

## Current State Assessment

### Files Discovered

| File | Lines | Purpose |
|------|-------|---------|
| `/CLAUDE.md` | ~60 | Monorepo overview, commands, structure |
| `/apps/greyboard/CLAUDE.md` | ~360 | App-specific patterns, tech stack, philosophy |
| `/.claude/settings.json` | - | Hook configuration for auto-formatting |
| `/.claude/settings.local.json` | - | Permission allowlists |
| `/.claude/health.md` | - | Context health tracking |
| `/.claude/opportunities.md` | - | Improvement tracking |
| `/.claude/commands/` | 10+ files | Specialized commands |
| `/.claude/agents/` | 3 files | AI agents (code-architect, context-guardian, design-system-manager) |
| `/.claude/skills/` | 86+ files | Vercel React best practices |

### What's Working Well

1. **Clean separation of concerns**
   - Root CLAUDE.md covers monorepo basics only
   - App CLAUDE.md covers app-specific patterns
   - No duplication between levels

2. **Comprehensive documentation**
   - Tech stack clearly documented
   - Code philosophy defined (YAGNI, KISS, SoC)
   - Development patterns with code examples

3. **Mature `.claude/` infrastructure**
   - Health monitoring in place
   - Opportunity tracking
   - Specialized agents and commands
   - Skills for React/Next.js best practices

4. **Good practices followed**
   - Import conventions documented
   - Naming conventions defined
   - State management guidance clear

### Issues Identified

#### 1. Greyboard CLAUDE.md Too Long (~360 lines)

**Problem**: Long CLAUDE.md files consume context and Claude may ignore important instructions.

**Recommendation**: Keep CLAUDE.md to ~200 lines max.

**Content that could be moved**:
- Detailed feature descriptions (Kanban, Insights, Projects, Time Tracking)
- Extensive code examples
- Debugging patterns
- Component library details

#### 2. No `.claude/rules/` Directory

**Problem**: Path-specific rules aren't being used, even though the infrastructure supports them.

**Benefit of rules**:
- Modular organization (one file per topic)
- Path-specific rules apply only to matching files
- Easier to maintain than monolithic CLAUDE.md
- Don't consume main context unless relevant

#### 3. No CLAUDE.local.md Files

**Problem**: No personal/local overrides for developers.

**Use case**: Individual developer preferences that shouldn't be committed to git.

#### 4. Missing Monorepo-Specific Rules

**Problem**: Import conventions and workspace patterns aren't in a dedicated rules file.

---

## Improvement Plan

### Phase 1: Trim Greyboard CLAUDE.md (Priority: High)

**Goal**: Reduce from ~360 lines to ~200 lines

**Keep in CLAUDE.md**:
- Quick start commands
- Tech stack overview (table format)
- Code philosophy (brief)
- Project structure (essential directories only)
- State management decision tree
- Core principles (YAGNI, KISS, SoC)
- Naming conventions
- Import conventions

**Move to skills or rules**:
- Detailed feature descriptions
- Extensive code examples for forms
- Component patterns with full code blocks
- Debugging patterns
- Performance details

### Phase 2: Create `.claude/rules/` Structure (Priority: Medium)

Create the following rule files:

```
.claude/rules/
├── typescript.md           # General TypeScript rules
├── react-components.md     # Component patterns
├── forms.md               # Form handling patterns
├── state-management.md    # Zustand, Context, localStorage
├── monorepo.md            # Workspace conventions
└── apps/
    └── greyboard/
        ├── features.md    # Feature pattern rules
        └── hooks.md       # Hook conventions
```

**Example rule file with path frontmatter**:

```markdown
---
paths:
  - "apps/greyboard/features/**/*.tsx"
  - "apps/greyboard/features/**/*.ts"
---

# Feature Pattern Rules

- Each feature in its own directory under `features/`
- Feature exports via barrel file (index.ts)
- Co-locate components, hooks, utils within feature
- Feature-specific types in `types.ts`
```

### Phase 3: Create Monorepo Rules File (Priority: Medium)

**File**: `.claude/rules/monorepo.md`

**Content**:
```markdown
---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Monorepo Conventions

## Package Imports
- Import workspace packages via `@feel-good/*` aliases
- Never use relative paths across package boundaries
- Workspace packages: @feel-good/utils, @feel-good/icons

## Commands
- Use `pnpm --filter=@feel-good/[app]` for single app operations
- Run `pnpm install` from root after adding dependencies
- Build affected packages after changes to shared packages

## Adding New Packages
1. Create directory in `packages/`
2. Add `package.json` with name `@feel-good/package-name`
3. Add to consuming apps' dependencies
4. Run `pnpm install` from root
```

### Phase 4: Create Feature Documentation Skill (Priority: Low)

**File**: `.claude/skills/greyboard-features/SKILL.md`

Move detailed feature documentation here:
- Kanban board implementation details
- Insights analytics patterns
- Projects feature architecture
- Time tracking implementation

### Phase 5: Add CLAUDE.local.md Template (Priority: Low)

Create example template for developers:

**File**: `CLAUDE.local.md.example`

```markdown
# Personal Claude Preferences

## My Editor
- Using VS Code with Vim keybindings

## My Focus
- Currently working on [feature]

## My Preferences
- Prefer verbose explanations
- Always show file paths in responses
```

---

## Implementation Checklist

### Phase 1: Trim CLAUDE.md
- [ ] Identify content to remove from greyboard CLAUDE.md
- [ ] Create backup of current file
- [ ] Edit down to ~200 lines
- [ ] Verify essential information retained
- [ ] Test Claude responses still follow patterns

### Phase 2: Create Rules Structure
- [ ] Create `.claude/rules/` directory
- [ ] Create `typescript.md` with general rules
- [ ] Create `react-components.md` with component patterns
- [ ] Create `forms.md` with form handling
- [ ] Create `state-management.md` with state patterns
- [ ] Create `apps/greyboard/features.md`
- [ ] Create `apps/greyboard/hooks.md`

### Phase 3: Monorepo Rules
- [ ] Create `.claude/rules/monorepo.md`
- [ ] Document import conventions
- [ ] Document command patterns
- [ ] Document package addition workflow

### Phase 4: Feature Skill
- [ ] Create `.claude/skills/greyboard-features/` directory
- [ ] Create `SKILL.md` with feature documentation
- [ ] Move detailed feature docs from CLAUDE.md

### Phase 5: Local Template
- [ ] Create `CLAUDE.local.md.example` in root
- [ ] Add to `.gitignore`: `CLAUDE.local.md`
- [ ] Document usage in root CLAUDE.md

---

## Success Metrics

1. **Greyboard CLAUDE.md** reduced to ≤200 lines
2. **Rules directory** has ≥5 topic-specific files
3. **Path-specific rules** use frontmatter correctly
4. **No duplication** between CLAUDE.md and rules
5. **Claude responses** still follow documented patterns

---

## References

- [Claude Code Memory Documentation](https://docs.anthropic.com/en/docs/claude-code/memory)
- [Claude Code Best Practices](https://docs.anthropic.com/en/docs/claude-code/best-practices)
- Current health status: `/.claude/health.md`
