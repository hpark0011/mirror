---
name: Documentation Breakdown Pattern
category: Architecture
applies_to: [documentation, patterns, agents]
updated: 2025-01-14
documented_in: context-guardian.md
---

# Documentation Breakdown Pattern

When you detect large documentation files (>600 lines), suggest breaking them down following Claude Code's official conventions.

## When to Suggest Breakdown

✅ **DO suggest when:**
- File exceeds 600 lines
- File covers 3+ distinct topics
- File is significantly larger than other similar files
- Topics can be logically separated
- Navigation becomes difficult

❌ **DON'T suggest when:**
- File is 400-600 lines (manageable size)
- Content is tightly coupled (can't separate cleanly)
- Topics are interdependent
- Breaking it would create too many cross-references

## The Subdirectory Pattern

**Structure:**
```
.claude/commands/patterns/
├── topic.md                  # Navigation index (~200 lines)
└── topic/
    ├── subtopic-1.md         # Focused file (~200-400 lines)
    ├── subtopic-2.md         # Focused file (~200-400 lines)
    └── subtopic-3.md         # Focused file (~200-400 lines)
```

**Example structure:**
```
.claude/commands/patterns/
├── {topic}.md                    # Navigation index (~200 lines)
└── {topic}/
    ├── overview.md               # Quick start, decision tree
    ├── subtopic-a.md             # Focused subtopic
    ├── subtopic-b.md             # Focused subtopic
    └── examples.md               # Examples & checklists
```

## YAML Frontmatter Requirements

**Each sub-file MUST have:**
```yaml
---
name: Descriptive Name
category: Architecture
applies_to: [specific, scopes]
updated: YYYY-MM-DD
documented_in: CLAUDE.md
parent: original-file.md
---
```

**Index file:**
```yaml
---
name: Topic Name
category: Architecture
applies_to: [broad, scope]
updated: YYYY-MM-DD
documented_in: CLAUDE.md
---
```

## Navigation Index Pattern

The index file (`topic.md`) should:

1. **Link to all sub-files:**
```markdown
## Quick Navigation

- **[Subtopic 1](./topic/subtopic-1.md)** - Brief description
- **[Subtopic 2](./topic/subtopic-2.md)** - Brief description
- **[Subtopic 3](./topic/subtopic-3.md)** - Brief description
```

2. **Provide quick reference:**
- Decision trees (ASCII diagrams)
- Common patterns table
- DO/DON'T lists
- Getting started guide

3. **Maintain discoverability:**
- Related patterns links
- External resources
- Quick examples

## Sub-File Structure

Each sub-file should:

1. **Have navigation breadcrumbs:**
```markdown
## Navigation

- **[← Back to Overview](./overview.md)**
- **[Related Topic →](./related.md)**
```

2. **Be self-contained:**
- Complete explanation of the topic
- Code examples included
- No dependency on reading other files first

3. **Cross-link when needed:**
- Link to related sub-files
- Reference the index for overview
- Point to examples for implementation

## Verification Checklist

When suggesting a breakdown, verify:

- [ ] Each sub-file <700 lines (ideally 200-500)
- [ ] All files have proper YAML frontmatter
- [ ] Index file links to all sub-files
- [ ] Sub-files have navigation breadcrumbs
- [ ] Cross-references updated in other files
- [ ] Total line count documented
- [ ] Content preserved (nothing lost)

**Verification commands:**
```bash
# Count lines in all files
wc -l topic.md topic/*.md

# Check frontmatter exists
head -8 topic/*.md

# Find cross-references
grep -r "topic" .claude/
```

## Migration Process

1. **Create subdirectory:**
   ```bash
   mkdir -p .claude/commands/patterns/topic
   ```

2. **Extract content into sub-files:**
   - Identify logical topic boundaries
   - Copy content to new files
   - Add YAML frontmatter to each

3. **Rewrite index file:**
   - Replace original content with navigation
   - Add decision trees and quick reference
   - Link to all sub-files

4. **Verify cross-references:**
   - Search for references to original file
   - Ensure they still point to valid content
   - Update if necessary (usually index file works)

5. **Verify content preservation:**
   - Compare total line counts
   - Ensure all examples included
   - Check that nothing was lost

## Example Suggestion Format

When suggesting a breakdown, provide:

```markdown
### 📋 Medium Priority

1. **Large documentation file detected**: {filename}.md
   - Current size: {lines} lines
   - Comparison: Next largest file is {comparison} lines
   - Topics identified: {count} distinct topics
   - Opportunity: Break down into focused sub-files
   - Effort: 2 hours (extract, reorganize, verify)
   - Benefits:
     - Each file <500 lines (easier to navigate)
     - Focused topics (find information faster)
     - Modular structure (easier to maintain)
   - Proposed structure:
     ```
     {filename}.md                 # Navigation index (~200 lines)
     {filename}/
       ├── topic-1.md              # {description} (~{lines} lines)
       ├── topic-2.md              # {description} (~{lines} lines)
       └── topic-3.md              # {description} (~{lines} lines)
     ```
   - Reference: split when a single pattern file exceeds ~800 lines
```

## Follow Claude Code Conventions

This pattern follows Claude Code's official documentation principles:

✅ **Keep rules focused**: Each file covers one topic
✅ **Descriptive filenames**: Filename indicates content
✅ **Modular over monolithic**: Multiple focused files vs one large file
✅ **Automatic loading**: All `.md` files in `.claude/` are loaded
✅ **Subdirectories supported**: Can organize by domain

**Reference:** Claude Code official docs recommend breaking down large documentation into focused, topic-specific files for larger projects.
