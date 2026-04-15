---
name: REPLACE-lowercase-hyphen-name
argument-hint: "[REPLACE — short slot label, e.g. <skill-name> or <ticket-id>. Delete this line if the skill takes no arguments.]"
description: REPLACE — what it does AND when to use it. Third person. Include concrete trigger phrases (e.g. "Use when the user says X"). ≤1024 chars. No angle brackets.
---

# REPLACE Skill Title

One-paragraph purpose statement. Assume Claude is smart — don't explain domain basics.

## Scope & non-goals
What this skill is NOT for. Sibling skills to prefer in adjacent cases. Edge cases where it shouldn't fire.
(Trigger phrases live in the frontmatter `description` — don't duplicate them here.)

## Quick start
The 80% case in ≤10 lines. Minimum viable invocation.

## Workflow
Numbered steps. For fragile/multi-step tasks, include a copy-able checklist.
Build in feedback loops: run → validate → fix → repeat.

## Examples
Concrete input/output pairs. Not abstract descriptions.

## References
- **Advanced X** → [advanced.md](advanced.md)
- **API reference** → [reference.md](reference.md)
(Only if SKILL.md approaches 500 lines. Keep links one level deep.)

## Anti-patterns
What NOT to do and why. Encodes past failure modes.
