#!/usr/bin/env python3
"""
Skill Validator — checks a skill against create-skill conventions.

Usage:
    scripts/validate_skill.py <path/to/skill-directory>

Checks (errors → exit 1, warnings → exit 0):
  - SKILL.md exists with valid YAML frontmatter
  - name: ^[a-z0-9-]+$, ≤64 chars, no reserved words, matches directory
  - description: present, ≤1024 chars, third-person heuristic, trigger phrase hint
  - body: ≤500 lines
  - references: one level deep (no nested links from nested files)
  - no inlined code blocks larger than ~20 lines (artifact extraction rule)
  - no time-stamped language ("as of 2025", "in 2026", etc.)
"""

import sys
import re
from pathlib import Path

RESERVED = {"anthropic", "claude"}
MAX_DESC = 1024
MAX_LINES = 500
MAX_INLINE_BLOCK = 20


def parse_frontmatter(content: str):
    if not content.startswith("---"):
        return None, "No YAML frontmatter found"
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", content, re.DOTALL)
    if not m:
        return None, "Invalid frontmatter delimiters"
    fm_text, body = m.group(1), m.group(2)
    fm = {}
    for line in fm_text.splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip()
    return (fm, body), None


def validate(skill_path: Path):
    errors, warnings = [], []
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return [f"SKILL.md not found in {skill_path}"], []

    content = skill_md.read_text()
    parsed, err = parse_frontmatter(content)
    if err:
        return [err], []
    fm, body = parsed

    name = fm.get("name", "").strip()
    if not name:
        errors.append("Missing 'name' in frontmatter")
    else:
        if not re.match(r"^[a-z0-9-]+$", name):
            errors.append(f"name '{name}' must match ^[a-z0-9-]+$")
        if len(name) > 64:
            errors.append(f"name too long ({len(name)} chars, max 64)")
        for r in RESERVED:
            if r in name.split("-"):
                errors.append(f"name contains reserved word '{r}'")
        if name != skill_path.name:
            errors.append(f"name '{name}' must match directory '{skill_path.name}'")

    desc = fm.get("description", "").strip()
    if not desc:
        errors.append("Missing 'description' in frontmatter")
    else:
        if len(desc) > MAX_DESC:
            errors.append(f"description too long ({len(desc)} chars, max {MAX_DESC})")
        if "<" in desc or ">" in desc:
            errors.append("description cannot contain angle brackets")
        if re.search(r"\bi (help|can|will)\b", desc, re.I):
            warnings.append("description reads first-person — prefer third-person")
        if not re.search(r"\b(use when|triggers on|when the user|invoke)\b", desc, re.I):
            warnings.append("description should name concrete trigger phrases ('Use when...', 'Triggers on...')")

    body_lines = body.splitlines()
    if len(body_lines) > MAX_LINES:
        errors.append(f"body is {len(body_lines)} lines (max {MAX_LINES}) — split into references/")

    for block in re.finditer(r"```[\s\S]*?```", body):
        inner = block.group(0).splitlines()
        if len(inner) > MAX_INLINE_BLOCK + 2:
            warnings.append(
                f"inline code block is {len(inner) - 2} lines (>{MAX_INLINE_BLOCK}) — extract to {{name}}-template/"
            )
            break

    if re.search(r"\b(as of|in) 20\d{2}\b", body, re.I):
        warnings.append("body contains time-stamped language — rots quickly")

    # Each entry is either a single required heading, or a tuple of acceptable aliases.
    # "Scope & non-goals" is optional — include it only when sibling skills risk misfiring.
    required_sections = [
        "Quick start",
        "Workflow",
        "Examples",
        "Anti-patterns",
    ]
    headings = re.findall(r"^##\s+(.+?)\s*$", body, re.M)
    heading_set = {h.strip() for h in headings}
    for section in required_sections:
        aliases = section if isinstance(section, tuple) else (section,)
        if not any(a in heading_set for a in aliases):
            label = " / ".join(f"'{a}'" for a in aliases)
            errors.append(
                f"missing required H2 section {label} — see create-skill/skill-template/SKILL.md"
            )

    for ref in skill_path.glob("*/SKILL.md"):
        continue
    for md in skill_path.rglob("*.md"):
        if md.name == "SKILL.md":
            continue
        depth = len(md.relative_to(skill_path).parts)
        if depth > 2:
            warnings.append(f"{md.relative_to(skill_path)} is nested >1 level deep from SKILL.md")

    return errors, warnings


def main():
    if len(sys.argv) != 2:
        print("Usage: validate_skill.py <path/to/skill-directory>")
        sys.exit(1)
    skill_path = Path(sys.argv[1]).resolve()
    errors, warnings = validate(skill_path)

    for w in warnings:
        print(f"⚠️  {w}")
    for e in errors:
        print(f"❌ {e}")

    if errors:
        print(f"\nFAILED — {len(errors)} error(s), {len(warnings)} warning(s)")
        sys.exit(1)
    print(f"\n✅ Valid — {len(warnings)} warning(s)")
    sys.exit(0)


if __name__ == "__main__":
    main()
