# Sync Documentation Context

You are a documentation maintainer for this codebase. Your role is to analyze the current state of the codebase and identify discrepancies with `CLAUDE.md` and `.claude/` files.

## Analysis Process

Follow these steps systematically:

### 1. Project Structure Analysis

**Task**: Compare actual directory structure against documented structure in CLAUDE.md

**Steps**:
1. Read `CLAUDE.md` and locate the "Project Structure" section
2. Scan these directories: `app/`, `components/`, `hooks/`, `config/`, `lib/`, `store/`, `styles/`, `types/`, `utils/`
3. List all subdirectories found
4. Compare against what's documented in CLAUDE.md
5. Identify:
   - ✅ Directories that exist and are documented
   - ❌ New directories not documented
   - ⚠️ Documented directories that don't exist

### 2. Tech Stack Dependencies

**Task**: Compare package.json against Tech Stack section in CLAUDE.md

**Steps**:
1. Read `package.json`
2. Extract all production dependencies (`dependencies`)
3. Extract relevant dev dependencies (testing, linting, build tools)
4. Read CLAUDE.md "Tech Stack" section
5. Identify:
   - ❌ Version mismatches (e.g., docs say Next.js 15.4.7, package.json has 15.4.10)
   - ❌ Missing dependencies in docs
   - ✅ Dependencies correctly documented

### 3. Pattern Files Audit

**Task**: Validate all pattern files have proper frontmatter

**Steps**:
1. List all files in `.claude/commands/patterns/`
2. Read each pattern file
3. Check for YAML frontmatter with these fields:
   - `name`: Pattern display name
   - `category`: Pattern category
   - `applies_to`: List of applicable areas
   - `updated`: Last update date
   - `documented_in`: Reference to CLAUDE.md
4. Identify:
   - ✅ Pattern files with valid frontmatter
   - ⚠️ Pattern files missing frontmatter
   - ⚠️ Pattern files with incomplete frontmatter

### 4. Custom Hooks Inventory

**Task**: Compare hooks/ directory against documented hooks

**Steps**:
1. List all `.ts` and `.tsx` files in `hooks/` directory
2. Read CLAUDE.md "Custom Hooks" section
3. Identify:
   - ❌ New hooks not documented
   - ✅ Hooks correctly documented
   - ⚠️ Documented hooks that don't exist

### 5. Feature Completeness Check

**Task**: Identify major features and verify documentation

**Steps**:
1. Scan `app/` directory for major routes (dashboard/, insights/, etc.)
2. Check `components/` for major feature directories (tasks/, files/, etc.)
3. Read CLAUDE.md "Key Features & Implementation" section
4. Identify:
   - ❌ Undocumented features (e.g., new routes, major components)
   - ✅ Features correctly documented
   - ⚠️ Documented features that no longer exist

## Output Format

Generate a health report in this exact format and write it to `.claude/health.md`:

```markdown
# Context Health Report

**Generated**: {current_timestamp}
**Status**: {HEALTHY|NEEDS_UPDATE|OUT_OF_SYNC}
**Last Full Sync**: {date_from_previous_report_or_today}

---

## Summary

- **Total Discrepancies**: {count}
- **Critical Issues**: {count_of_critical_issues}
- **Warnings**: {count_of_warnings}

---

## Discrepancies Found

### 1. Project Structure

{For each discrepancy}:
- ❌ New directory: `{path}` - Not documented in CLAUDE.md
- ⚠️ Documented directory missing: `{path}`
- ✅ All documented directories exist

### 2. Tech Stack

{For each discrepancy}:
- ❌ Version mismatch: **{package}** - Docs say {doc_version}, package.json has {actual_version}
- ❌ Missing from docs: **{package_name}** ({version})
- ✅ All dependencies correctly documented

### 3. Patterns

{For each pattern file}:
- ✅ `{filename}` - Valid frontmatter
- ⚠️ `{filename}` - Missing frontmatter
- ⚠️ `{filename}` - Incomplete frontmatter (missing: {fields})

### 4. Custom Hooks

{For each hook}:
- ❌ Undocumented: `{hook_filename}` in hooks/ directory
- ✅ All hooks documented

### 5. Features

{For each feature}:
- ❌ Undocumented feature: {feature_name} at `{path}`
- ✅ All features documented

---

## Suggested Updates

{For each issue, provide specific diff or instructions}:

### Update CLAUDE.md Line {line_number}: Tech Stack

\```diff
- **Next.js 15.4.7** with App Router
+ **Next.js 15.4.10** with App Router
\```

### Add to CLAUDE.md: Project Structure

\```diff
hooks/
   use-local-storage.ts
   use-projects.ts
+  use-new-hook.ts  # New hook found
\```

### Add Frontmatter to Pattern File

File: `.claude/commands/patterns/{filename}.md`

\```yaml
---
name: {Suggested Name}
category: {Component Organization|Architecture}
applies_to: [{suggested_areas}]
updated: {today}
documented_in: CLAUDE.md
---
\```

---

## Action Items

1. [ ] Review suggested updates above
2. [ ] Update CLAUDE.md with tech stack changes
3. [ ] Document new directories in Project Structure section
4. [ ] Add frontmatter to pattern files
5. [ ] Document new hooks in Custom Hooks section
6. [ ] Document new features in Key Features section

---

## Recent Changes Log

{Append to changelog}:
- [{timestamp}] Ran sync-docs, found {count} discrepancies

```

## Status Determination Logic

Use this logic to determine overall status:

- **HEALTHY**: 0 discrepancies, all checks pass
- **NEEDS_UPDATE**: 1-5 minor discrepancies (version mismatches, missing frontmatter)
- **OUT_OF_SYNC**: 6+ discrepancies OR critical issues (undocumented major features, missing directories)

## Best Practices

1. **Be Specific**: Always provide exact file paths and line numbers
2. **Provide Diffs**: Show exact changes needed using diff format
3. **Prioritize**: List critical issues first
4. **Be Actionable**: Every suggestion should be implementable immediately
5. **Update Health File**: Always write results to `.claude/health.md`
6. **Preserve History**: Append to changelog, don't overwrite

## Example Output Structure

```markdown
# Context Health Report

**Generated**: 2025-01-13 14:45:00
**Status**: NEEDS_UPDATE
**Last Full Sync**: 2025-01-13

---

## Summary

- **Total Discrepancies**: 3
- **Critical Issues**: 0
- **Warnings**: 3

---

## Discrepancies Found

### 1. Project Structure

✅ All documented directories exist

### 2. Tech Stack

❌ Version mismatch: **Next.js** - Docs say 15.4.7, package.json has 15.4.10

### 3. Patterns

⚠️ `composition.md` - Missing frontmatter
⚠️ `features.md` - Missing frontmatter

### 4. Custom Hooks

✅ All 18 hooks documented

### 5. Features

✅ All features documented

---

## Suggested Updates

### Update CLAUDE.md Line 48: Tech Stack

\```diff
- **Next.js 15.4.7** with App Router
+ **Next.js 15.4.10** with App Router
\```

### Add Frontmatter to composition.md

\```yaml
---
name: Composition Pattern
category: Component Organization
applies_to: [components, features]
updated: 2025-01-13
documented_in: CLAUDE.md
---
\```

---

## Action Items

1. [ ] Update CLAUDE.md Line 48 with Next.js version
2. [ ] Add frontmatter to 2 pattern files

---

## Recent Changes Log

- [2025-01-13 14:45:00] Ran sync-docs, found 3 discrepancies (1 version mismatch, 2 missing frontmatter)
```

---

## After Analysis

1. Write the complete health report to `.claude/health.md`
2. Display a summary to the user
3. Highlight the most critical issues
4. Provide the first 2-3 actionable steps they should take
5. **Suggest next step**: If status is NEEDS_UPDATE or OUT_OF_SYNC, recommend:

   > 💡 **Next Step**: Run the context-guardian agent to identify improvement opportunities and automation suggestions.
   >
   > The guardian will analyze codebase patterns, git history, and conversation context to suggest new commands, skills, or documentation improvements.
   >
   > Invoke with: "Run context guardian to check for opportunities"
