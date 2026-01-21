---
name: edit-command
description: Refine and improve an existing custom Claude Code command
argument-hint: "[command path, e.g., code-review or patterns/forms]"
---

# Edit Custom Command

Read and refine an existing custom command file. Primary goal: **eliminate redundancy** while preserving all unique information.

## Target Command

Refine the command at: `.claude/commands/$ARGUMENTS.md`

## Workflow

### Step 1: Read the Current Command

Read the target command file. Identify:
- The command's purpose
- Its current structure and sections
- Total line count (baseline for measuring compression)

### Step 2: Detect Redundancy

**This is the most important step.** Scan for:

| Redundancy Type | What to Look For |
|-----------------|------------------|
| Rule repetition | Same rule stated in 3+ places (principles, guidelines, checklist, examples) |
| Section overlap | AI Guidelines ≈ Checklist ≈ Examples teaching same thing |
| Prose patterns | Repeated structures that could be a single table |
| Soft language | "Should", "consider", "try to" that dilute hard requirements |

Flag every instance where the same concept appears multiple times. Note which statement is most complete—that becomes the canonical version.

### Step 3: Apply Compression Principles

Apply these four principles in order:

#### 1. One Rule, One Place

Same rule in multiple sections? Keep the canonical statement, delete or reference elsewhere.

```markdown
# Before (in 4 sections)
Principles: "Use kebab-case for files"
Guidelines: "File names should be kebab-case"
Checklist: "[ ] Files use kebab-case"
Example: "// user-profile.tsx follows our kebab-case convention"

# After (1 section + optional checklist reference)
Naming: "Files use kebab-case (e.g., user-profile.tsx)"
Checklist: "[ ] Naming conventions followed (see Naming section)"
```

#### 2. Tables Over Prose

Repeated structures with variations? Convert to decision table.

```markdown
# Before (40 lines)
## Container Components
Container components hold state and pass it down...
They should be named with a Container suffix...
Examples include UserContainer, DashboardContainer...

## Presentational Components
Presentational components receive props and render UI...
They should not hold state...
Examples include UserCard, DashboardHeader...

# After (10 lines)
| Type | Holds State | Naming | Example |
|------|-------------|--------|---------|
| Container | Yes | *Container suffix | UserContainer |
| Presentational | No | Descriptive noun | UserCard |
```

#### 3. Constraints Over Advice

Soft recommendations? Convert to hard requirements or delete.

```markdown
# Before
"You should consider keeping components under 100 lines"
"Try to extract hooks when logic is complex"

# After
"Components: max 100 lines. Extract hooks for reusable logic."
```

#### 4. Examples Prove, Don't Teach

Example with explanation that restates the rule? Keep code, remove redundant prose.

```markdown
# Before
Here's an example of the kebab-case naming convention we discussed
above in the naming section. Notice how the file uses lowercase
letters with hyphens:
// user-profile.tsx

# After
// user-profile.tsx ✓
// UserProfile.tsx ✗
```

### Step 4: Verify Single-Source

After compression, verify:
- Each rule appears in exactly one place
- No section restates another section
- Tables replaced all repeated patterns
- All "should/consider/try" either hardened or removed

**Measure:** Final line count should be 30-50% of original if significant redundancy existed.

### Step 5: Summarize Changes

Report:
1. Redundancies found (with specific counts)
2. Compressions applied
3. Line count reduction (e.g., "147 → 89 lines, 39% reduction")
4. Any rules that were ambiguous or contradictory

## Constraints

- Preserve all unique information—compression ≠ deletion of content
- Keep the command's fundamental purpose intact
- Ask before removing entire sections
- If a rule appears 4 times with slightly different wording, choose the most precise version

## Success Criteria

- [ ] Each rule appears exactly once
- [ ] Repeated patterns converted to tables
- [ ] No soft language remains ("should consider" → requirement or deleted)
- [ ] Line count reduced (target: 30-50% for bloated commands)
- [ ] All original information preserved (just not duplicated)
