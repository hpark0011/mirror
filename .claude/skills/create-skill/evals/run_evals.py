#!/usr/bin/env python3
"""
Eval fixture runner for create-skill.

These fixtures encode the three highest-value failure modes the skill must not
regress on. They are not executed against a live model — they are checklists a
reviewer (human or agent) walks through when editing SKILL.md.

Usage:
    evals/run_evals.py           # list all fixtures with expectations + failure modes
    evals/run_evals.py --lint    # validate fixture schema only (CI-friendly)

Exit 0 on success, 1 on schema error.
"""

import json
import sys
from pathlib import Path

REQUIRED_KEYS = {"name", "skill", "query", "expected_behavior", "failure_modes"}
EVALS_DIR = Path(__file__).resolve().parent


def load_fixtures():
    return sorted(EVALS_DIR.glob("*.json"))


def lint(fixture_path: Path) -> list[str]:
    try:
        data = json.loads(fixture_path.read_text())
    except json.JSONDecodeError as e:
        return [f"invalid JSON: {e}"]
    errors = []
    missing = REQUIRED_KEYS - data.keys()
    if missing:
        errors.append(f"missing keys: {sorted(missing)}")
    if data.get("skill") != "create-skill":
        errors.append(f"skill field is '{data.get('skill')}', expected 'create-skill'")
    for key in ("expected_behavior", "failure_modes"):
        if key in data and not isinstance(data[key], list):
            errors.append(f"{key} must be a list")
        elif key in data and not data[key]:
            errors.append(f"{key} is empty")
    return errors


def print_fixture(fixture_path: Path) -> None:
    data = json.loads(fixture_path.read_text())
    print(f"\n── {fixture_path.name}: {data['name']} ──")
    print(f"Query: {data['query']}")
    print("Expected:")
    for item in data["expected_behavior"]:
        print(f"  ✓ {item}")
    print("Must not:")
    for item in data["failure_modes"]:
        print(f"  ✗ {item}")


def main() -> int:
    lint_only = "--lint" in sys.argv
    fixtures = load_fixtures()
    if not fixtures:
        print("No fixtures found in evals/")
        return 1

    total_errors = 0
    for f in fixtures:
        errors = lint(f)
        if errors:
            total_errors += len(errors)
            print(f"❌ {f.name}")
            for e in errors:
                print(f"   {e}")
            continue
        if not lint_only:
            print_fixture(f)

    if total_errors:
        print(f"\nFAILED — {total_errors} schema error(s) across {len(fixtures)} fixture(s)")
        return 1
    print(f"\n✅ {len(fixtures)} fixture(s) valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
