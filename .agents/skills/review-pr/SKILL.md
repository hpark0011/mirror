---
name: review-pr
description: Fetch and display PR review comments for the current branch, then optionally resolve them. Use when the user wants to check PR feedback, address review comments, or see what reviewers said.
user_invocable: true
triggers:
  - review-pr
  - pr comments
  - review comments
  - check pr
  - pr feedback
---

# PR Review Comments

Fetch review comments from the GitHub PR associated with the current branch, assess their relevance, and present them for action.

## Step 1: Identify the PR

```bash
number=$(gh pr view --json number --jq '.number')
base_branch=$(gh pr view --json baseRefName --jq '.baseRefName')
repo_full_name=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
owner=${repo_full_name%%/*}
repo=${repo_full_name#*/}
```

If no PR is found for the current branch, tell the user and stop.

## Step 2: Fetch Review Comments

Fetch all review comments (inline code comments and review-level comments):

```bash
# Inline code review comments (comments on specific lines of code)
gh api "repos/$owner/$repo/pulls/$number/comments" --jq '.[] | {id, path, line, body, user: .user.login, created_at, in_reply_to_id, diff_hunk}'

# Review-level comments (top-level review summaries)
gh api "repos/$owner/$repo/pulls/$number/reviews" --jq '.[] | {id, state, body, user: .user.login, submitted_at}'
```

Get the owner/repo from:

```bash
repo_full_name=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
owner=${repo_full_name%%/*}
repo=${repo_full_name#*/}
```

## Step 3: Present Comments

Group and display comments in this format:

```text
PR #{number}: {title}
Status: {state} | Review decision: {reviewDecision}
URL: {url}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Review by {user} ({state})

{review body, if any}

**{path}:{line}** — {user}
> {comment body}
  ↳ {reply body} — {reply_user}

...
```

- Group inline comments by file path.
- Show threaded replies indented under their parent comment.
- Highlight unresolved comments (no reply or resolution).
- Omit bot comments unless they contain actionable feedback.

## Step 4: Assess Relevance

For each comment thread, read the referenced file and surrounding code to determine:

1. **Still relevant** — The comment points to code that still exists and the issue is unaddressed.
2. **Already resolved** — The code has already been changed to address the concern (e.g., by a subsequent commit), but the comment thread was not explicitly resolved on GitHub.
3. **No longer applicable** — The referenced code was removed, significantly refactored, or the comment is about something that no longer exists in the current diff.
4. **Nitpick / stylistic** — The comment is a minor style preference, not a correctness or design concern.
5. **Incorrect / disagree** — The suggestion would introduce a bug, conflicts with project conventions (check AGENTS.md and .claude/rules/), or is based on a misunderstanding of the code.

Use `git diff "$base_branch"...HEAD` and the current file contents to make this assessment — do not guess from the comment text alone.

## Step 5: Report

Present the analysis as a summary table followed by details:

```text
## Summary

| Category            | Count |
| ------------------- | ----- |
| Still relevant      | N     |
| Already resolved    | N     |
| No longer applicable| N     |
| Nitpick / stylistic | N     |
| Incorrect / disagree| N     |

## Details

### Still relevant

- **{path}:{line}** — {brief description of the comment and why it's still valid}

### Already resolved

- **{path}:{line}** — {brief description and what resolved it}

...
```

Only include categories that have comments. After the report, ask the user if they want to address any of the still-relevant comments. If yes, read the relevant files and implement the requested changes.
