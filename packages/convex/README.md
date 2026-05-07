# @feel-good/convex

Shared Convex backend package with authentication email functionality.

## Installation

```bash
pnpm add @feel-good/convex
```

## Environment Variables

This package uses environment variables for email configuration. Set these in your Convex dashboard or via CLI:

```bash
# Set via Convex CLI
npx convex env set APP_NAME "YourAppName"
npx convex env set EMAIL_DOMAIN "yourapp.com"
```

### Required Variables

| Variable                     | Description                                                                                                                                          | Default                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `SITE_URL`                   | Base URL for authentication callbacks and OAuth Proxy current URL (e.g., `https://yourapp.com`, or `http://localhost:<worktree-port>` in a worktree) | **Required**                |
| `AUTH_ALLOWED_HOSTS`         | Comma-separated Better Auth dynamic base URL host allowlist (e.g., `localhost:*,127.0.0.1:*,yourapp.com`)                                            | Optional                    |
| `OAUTH_PROXY_ENABLED`        | Set to `true` to route social OAuth through a stable registered production callback                                                                  | Optional                    |
| `OAUTH_PROXY_PRODUCTION_URL` | Production app URL registered with the OAuth provider when OAuth Proxy is enabled                                                                    | Required when proxy enabled |
| `OAUTH_PROXY_SECRET`         | Dedicated shared secret for OAuth Proxy payloads across participating environments                                                                   | Optional                    |
| `GOOGLE_CLIENT_ID`           | Google OAuth client ID                                                                                                                               | **Required**                |
| `GOOGLE_CLIENT_SECRET`       | Google OAuth client secret                                                                                                                           | **Required**                |
| `APP_NAME`                   | Application name used in email sender and content                                                                                                    | `Mirror`                    |
| `EMAIL_DOMAIN`               | Domain for auth emails (e.g., `yourapp.com`)                                                                                                         | `mirror.app`                |

### Setting Auth Variables

```bash
npx convex env set SITE_URL "https://yourapp.com"
npx convex env set AUTH_ALLOWED_HOSTS "localhost:*,127.0.0.1:*,yourapp.com"
npx convex env set GOOGLE_CLIENT_ID "your-google-client-id"
npx convex env set GOOGLE_CLIENT_SECRET "your-google-client-secret"
```

For arbitrary local worktree ports, prefer Better Auth OAuth Proxy instead of
registering every `localhost:<port>` callback in Google:

```bash
npx convex env set OAUTH_PROXY_ENABLED "true"
npx convex env set OAUTH_PROXY_PRODUCTION_URL "https://yourapp.com"
npx convex env set OAUTH_PROXY_SECRET "shared-oauth-proxy-secret"
```

## Convex Sentry Integration

Convex exception reporting to Sentry is configured in the Convex dashboard integration settings (not via custom Sentry SDK code in Convex handlers).

### Setup

1. Open your Convex deployment in the Convex dashboard.
2. Enable the Sentry exception reporting integration.
3. Set required Convex environment variables:

```bash
npx convex env set SENTRY_DSN "https://<public-key>@o0.ingest.sentry.io/<project-id>"
```

Optional variables:

```bash
npx convex env set SENTRY_ENVIRONMENT "production"
npx convex env set SENTRY_RELEASE "mirror-<git-sha>"
```

### Notes

- Convex Sentry integration availability may depend on your Convex plan.
- This package intentionally does not add direct `@sentry/*` calls inside `packages/convex/convex/*` handlers for this rollout.

### Email Sender Format

Emails are sent from: `{APP_NAME} <auth@{EMAIL_DOMAIN}>`

Example: `MyApp <auth@myapp.com>`

## Seeding

Seed the Rick Rubin demo profile (user, articles, posts, conversations):

```bash
pnpm --filter=@feel-good/convex seed:rick-rubin
```

The command is idempotent — running it multiple times won't create duplicates.

## Exported Functions

### `sendMagicLink`

Sends a magic link email for passwordless authentication.

### `sendVerificationEmail`

Sends an email verification link to new users.

## Usage

```typescript
import { api } from "@feel-good/convex";

// In your Convex mutation/action
await ctx.runAction(api.email.sendMagicLink, {
  to: "user@example.com",
  link: "https://yourapp.com/auth/verify?token=...",
});
```
