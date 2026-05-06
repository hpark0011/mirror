---
name: greyboard-markdown
description: Open a .md/.mdx/.markdown file in the Greyboard desktop app on macOS. Use when the user says "open in greyboard" or "/greyboard-markdown".
argument-hint: <path-to-markdown-file>
---

Run `open -a Greyboard "<absolute-path>"`. Resolve relative paths against $PWD first. Requires Greyboard.app installed at `/Applications/Greyboard.app`.
