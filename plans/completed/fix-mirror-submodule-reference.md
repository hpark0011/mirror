# Fix: Convert apps/mirror from broken submodule to regular directory

## Overview

The `apps/mirror` folder appears on GitHub with an arrow icon and is unclickable because it's recorded as a submodule reference (gitlink) without a corresponding `.gitmodules` file. This needs to be converted to a regular tracked directory.

## Problem Statement

- **Current state:** Git sees `apps/mirror` as `160000 commit 651ec9f...` (submodule reference)
- **Expected state:** Git should see `apps/mirror` as `040000 tree ...` (regular directory)
- **Cause:** The folder was likely its own git repo when added, creating an orphaned submodule reference

## Acceptance Criteria

- [ ] `apps/mirror` displays as a normal folder on GitHub (no arrow icon)
- [ ] All files inside `apps/mirror` are visible and browsable on GitHub
- [ ] `git ls-tree HEAD apps/` shows `mirror` as type `tree`, not `commit`
- [ ] Monorepo turborepo commands work correctly with mirror app

## Implementation Steps

### Step 1: Remove the submodule reference from Git index

```bash
git rm --cached apps/mirror
```

This removes the gitlink entry without deleting local files.

### Step 2: Re-add mirror as a regular directory

```bash
git add apps/mirror/
```

This adds all files as regular tracked files.

### Step 3: Commit the fix

```bash
git commit -m "fix: Convert apps/mirror from submodule to regular directory

The mirror app was accidentally committed as a submodule reference
without a .gitmodules file, making it inaccessible on GitHub."
```

### Step 4: Push to remote

```bash
git push origin main
```

### Step 5: Verify on GitHub

- Refresh the repo page
- Confirm `apps/mirror` shows a normal folder icon
- Confirm all files inside are browsable

## Verification

After pushing, run:

```bash
git ls-tree HEAD apps/
```

Expected output:
```
040000 tree <sha>    apps/greyboard
040000 tree <sha>    apps/mirror
```

Both should show `tree` type (not `commit`).

## References

- Git documentation on submodules: https://git-scm.com/book/en/v2/Git-Tools-Submodules
- Related commit: `924a210` (Restructure to Turborepo monorepo)
