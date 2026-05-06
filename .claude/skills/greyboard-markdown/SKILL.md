---
name: greyboard-markdown
description: Open a markdown file in the Greyboard desktop app. Use when the user says "open in greyboard", "view in greyboard", "/greyboard-markdown", or asks to view/open any .md/.mdx/.markdown file in Greyboard — especially right after generating a plan or document and wanting to see it visually.
---

# greyboard-markdown

Opens a markdown file in the installed Greyboard desktop app.

## Input

A path to a markdown file. The user may give an absolute path, a path relative to the current working directory, or just a filename if the file was just created in this session.

## Steps

1. **Resolve the path.** If the user gave a relative path or filename, resolve it to an absolute path against the current working directory. If you can't find the file, ask the user to confirm the path.

2. **Validate.** The file must exist on disk and end in `.md`, `.mdx`, or `.markdown`. If not, stop and tell the user why.

3. **Run the open script:**

   ```bash
   bash .claude/skills/greyboard-markdown/open.sh "<absolute-path>"
   ```

4. **Report back** which file was opened. Do not say more — the user will see Greyboard come to focus.

## Notes

- Requires `Greyboard.app` installed at `/Applications/Greyboard.app` (macOS).
- If Greyboard is already running, the file opens in the existing window — Greyboard's `second-instance` handler in `src/main/index.ts` routes the new path into the running process.
- This skill does not create files. If the user asks to open content that hasn't been saved yet, write it to disk first, then invoke this skill.
