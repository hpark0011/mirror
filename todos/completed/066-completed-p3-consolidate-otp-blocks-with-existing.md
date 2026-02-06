---
status: completed
priority: p3
issue_id: "066"
tags: [auth, architecture, blocks]
dependencies: []
---

# Consolidate OTP Blocks with Existing Login/SignUp Blocks

## Problem Statement

The plan said to modify existing `LoginBlock`/`SignUpBlock` to swap magic link for OTP internally. Instead, new `OTPLoginBlock`/`OTPSignUpBlock` were created alongside the originals. This leaves 4 block variants exported where the plan intended 2.

## Current State

- `LoginBlock` — uses `MagicLinkLoginForm` (unchanged)
- `SignUpBlock` — uses `MagicLinkSignUpForm` (unchanged)
- `OTPLoginBlock` — uses `OTPLoginForm` (new)
- `OTPSignUpBlock` — uses `OTPSignUpForm` (new)

## Options

### Option A: Swap internals of existing blocks (original plan)
Replace `MagicLinkLoginForm` with `OTPLoginForm` inside `LoginBlock`. Remove separate OTP blocks.

### Option B: Keep separate blocks (current state)
Document that `LoginBlock`/`SignUpBlock` are magic-link variants and `OTPLoginBlock`/`OTPSignUpBlock` are OTP variants. This provides more flexibility but more surface area.

### Option C: Make blocks configurable via prop
Add a `method: "magic-link" | "otp"` prop to `LoginBlock`/`SignUpBlock`.

## Acceptance Criteria

- [ ] Decision made on approach
- [ ] Unused blocks either removed or documented
- [ ] Mirror app uses the canonical block names

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from plan audit | Plan Phase 6 specified modifying existing blocks |
