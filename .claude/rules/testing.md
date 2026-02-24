# Testing Guidelines

## E2E Testing: Playwright CLI Only

Use the Playwright CLI for e2e tests. Never use Playwright MCP or browser-automation MCP tools for testing.

```bash
pnpm --filter=@feel-good/mirror test:e2e    # Run all e2e tests
pnpm --filter=@feel-good/mirror test:e2e:ui  # Run with Playwright UI
```

Test files go in `apps/{app}/tests/` or `apps/{app}/e2e/`.

## Tool Boundaries

| Task | Tool |
|------|------|
| Automated testing | Playwright CLI (`playwright test`) |
| Visual debugging | Chrome MCP |
| Build verification | `pnpm build`, `pnpm lint` |
