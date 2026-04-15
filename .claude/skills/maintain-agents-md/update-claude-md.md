---
name: update-claude-md
description: Update existing CLAUDE.md files based on user requirements
---

# Update CLAUDE.md

Apply targeted updates to existing CLAUDE.md files based on user requirements.

## Prerequisites

Read `best-practices.md` for quality criteria and output template.

## Steps

### 1. Understand Requirements

Clarify user's update requirements:
- What needs to change?
- Why is the change needed?
- What should NOT change?

### 2. Inspect Current Setup

Read existing CLAUDE.md files:
- Root `CLAUDE.md`
- Any nested `CLAUDE.md` files in apps/packages (for monorepos)
- Note current structure, conventions, and content

Count current instructions and assess quality baseline.

### 3. Plan Updates

For each required change:
1. Identify affected sections
2. Draft the update
3. Explain why this change works

Consider:
- Does the change maintain instruction count targets (<50)?
- Does it follow best practices (terse, imperative)?
- Does it avoid anti-patterns (verbosity, redundancy, staleness)?
- Does it preserve existing well-written content?

Present the plan with rationale before applying.

### 4. Apply Updates

After user approval:
1. Show diff of proposed changes
2. Apply updates
3. Run self-review checklist:
   - [ ] Any instruction could be shorter?
   - [ ] Anything duplicated?
   - [ ] Every command verified?
   - [ ] Anything a linter handles?
4. Output final result

### 5. Offer Follow-up

After updates:
- Run full review to verify quality score maintained/improved
- Suggest additional improvements if found
