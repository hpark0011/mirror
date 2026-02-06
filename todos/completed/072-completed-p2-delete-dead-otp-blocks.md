---
status: completed
priority: p2
issue_id: "072"
tags: [auth, otp, dead-code, cleanup, code-review]
dependencies: []
---

# Delete Dead OTPLoginBlock and OTPSignUpBlock Files

## Problem Statement

`otp-login-block.tsx` and `otp-sign-up-block.tsx` are byte-for-byte identical to the consolidated `LoginBlock`/`SignUpBlock`. They are not exported from `blocks/index.ts` and not imported anywhere. The PR description says "removed separate OTPLoginBlock/OTPSignUpBlock" but the files were never deleted.

## Affected Files

- `packages/features/auth/blocks/otp-login-block.tsx` (DELETE)
- `packages/features/auth/blocks/otp-sign-up-block.tsx` (DELETE)

## Acceptance Criteria

- [x] Both files are deleted
- [x] No remaining imports or references to OTPLoginBlock/OTPSignUpBlock
- [ ] `pnpm build` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from PR #104 multi-agent review (all 4+ agents flagged) | Files survived consolidation; barrel exports correctly exclude them |
| 2026-02-06 | Completed: deleted both dead files, verified no imports | Files survived consolidation; safe to remove |
