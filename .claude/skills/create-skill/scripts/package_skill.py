#!/usr/bin/env python3
"""
Skill Packager — validate + zip a skill into a distributable .skill file.

Usage:
    scripts/package_skill.py <path/to/skill-folder> [output-directory]
"""

import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_skill import validate  # noqa: E402


def package_skill(skill_path: Path, output_dir: Path | None) -> Path | None:
    skill_path = skill_path.resolve()
    if not skill_path.is_dir():
        print(f"❌ Not a directory: {skill_path}")
        return None
    if not (skill_path / "SKILL.md").exists():
        print(f"❌ SKILL.md not found in {skill_path}")
        return None

    print("🔍 Validating...")
    errors, warnings = validate(skill_path)
    for w in warnings:
        print(f"⚠️  {w}")
    if errors:
        for e in errors:
            print(f"❌ {e}")
        print("Fix errors before packaging.")
        return None
    print("✅ Valid\n")

    out = (output_dir or Path.cwd()).resolve()
    out.mkdir(parents=True, exist_ok=True)
    skill_file = out / f"{skill_path.name}.skill"

    with zipfile.ZipFile(skill_file, "w", zipfile.ZIP_DEFLATED) as zf:
        for fp in skill_path.rglob("*"):
            if fp.is_file():
                arc = fp.relative_to(skill_path.parent)
                zf.write(fp, arc)
                print(f"  + {arc}")

    print(f"\n✅ Packaged → {skill_file}")
    return skill_file


def main():
    if len(sys.argv) < 2:
        print("Usage: package_skill.py <path/to/skill-folder> [output-directory]")
        sys.exit(1)
    skill_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    result = package_skill(skill_path, output_dir)
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
