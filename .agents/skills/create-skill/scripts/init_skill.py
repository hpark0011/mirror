#!/usr/bin/env python3
"""
Skill Initializer — scaffold a new project skill from skill-template/SKILL.md.

Usage:
    scripts/init_skill.py <skill-name> [--path .claude/skills]

Enforces this repo's create-skill conventions:
  - name matches ^[a-z0-9-]+$, ≤64 chars, no reserved words
  - directory name == frontmatter name
  - copies skill-template/SKILL.md verbatim (no example scripts/references/assets)

Run validate_skill.py afterwards.
"""

import sys
import re
import shutil
from pathlib import Path

RESERVED = {"anthropic", "claude"}
SKILL_DIR = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL_DIR / "skill-template" / "SKILL.md"


def validate_name(name: str) -> str | None:
    if not re.match(r"^[a-z0-9-]+$", name):
        return f"Name '{name}' must match ^[a-z0-9-]+$ (lowercase, digits, hyphens)."
    if name.startswith("-") or name.endswith("-") or "--" in name:
        return f"Name '{name}' cannot start/end with hyphen or contain '--'."
    if len(name) > 64:
        return f"Name too long ({len(name)} chars). Max 64."
    for r in RESERVED:
        if r in name.split("-"):
            return f"Name '{name}' contains reserved word '{r}'."
    return None


def init_skill(name: str, base_path: Path) -> Path | None:
    err = validate_name(name)
    if err:
        print(f"❌ {err}")
        return None

    if not TEMPLATE.exists():
        print(f"❌ Template not found at {TEMPLATE}")
        return None

    skill_dir = base_path.resolve() / name
    if skill_dir.exists():
        print(f"❌ Skill directory already exists: {skill_dir}")
        return None

    skill_dir.mkdir(parents=True)
    shutil.copy(TEMPLATE, skill_dir / "SKILL.md")
    print(f"✅ Created {skill_dir}/SKILL.md from template")

    print("\nNext steps:")
    print(f"  1. Edit {skill_dir}/SKILL.md — fill frontmatter + sections with real content")
    print("  2. Delete any section that has no real content (don't write 'N/A')")
    print(f"  3. Run: scripts/validate_skill.py {skill_dir}")
    return skill_dir


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print("Usage: init_skill.py <skill-name> [--path .claude/skills]")
        sys.exit(1)

    name = sys.argv[1]
    path = Path(".claude/skills")
    if "--path" in sys.argv:
        i = sys.argv.index("--path")
        path = Path(sys.argv[i + 1])

    print(f"🚀 Initializing skill: {name}")
    result = init_skill(name, path)
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
