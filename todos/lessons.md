# Lessons Learned

## 2026-02-09

- When using `@feel-good/ui/primitives/drawer`, every `DrawerContent` must include a `DrawerTitle` (can be hidden with `sr-only` via `DrawerHeader`) to satisfy Radix Dialog accessibility requirements and avoid runtime accessibility errors.
