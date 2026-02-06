---
status: completed
priority: p2
issue_id: "061"
tags: [auth, otp, ui, ux]
dependencies: []
---

# Use InputOTP Primitive with 3-3 Layout

## Problem Statement

The plan specified using the existing `InputOTP` primitive (`packages/ui/src/primitives/input-otp.tsx`) with a 3-3 group layout and separator for readability. The implementation uses a plain `<Input inputMode="numeric">` instead.

## Affected Files

- `packages/features/auth/views/otp-view.tsx` (OTP verification phase)

## Current Behavior

```tsx
<Input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  maxLength={6}
  placeholder="000000"
  ...
/>
```

## Expected Behavior (from plan Phase 4)

```tsx
<InputOTP maxLength={6}>
  <InputOTPGroup>
    <InputOTPSlot index={0} />
    <InputOTPSlot index={1} />
    <InputOTPSlot index={2} />
  </InputOTPGroup>
  <InputOTPSeparator />
  <InputOTPGroup>
    <InputOTPSlot index={3} />
    <InputOTPSlot index={4} />
    <InputOTPSlot index={5} />
  </InputOTPGroup>
</InputOTP>
```

## Acceptance Criteria

- [ ] OTP view uses `InputOTP` from `@feel-good/ui/primitives/input-otp`
- [ ] 3-3 layout with separator between groups
- [ ] `autoComplete="one-time-code"` preserved
- [ ] Controlled via `value`/`onChange` from hook

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from plan audit | Plan Phase 4 specified InputOTP with 3-3 layout |
