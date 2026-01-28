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

| Variable | Description | Default |
|----------|-------------|---------|
| `SITE_URL` | Base URL for authentication callbacks (e.g., `https://yourapp.com`) | **Required** |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | **Required** |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | **Required** |
| `APP_NAME` | Application name used in email sender and content | `Mirror` |
| `EMAIL_DOMAIN` | Domain for auth emails (e.g., `yourapp.com`) | `mirror.app` |

### Setting Auth Variables

```bash
npx convex env set SITE_URL "https://yourapp.com"
npx convex env set GOOGLE_CLIENT_ID "your-google-client-id"
npx convex env set GOOGLE_CLIENT_SECRET "your-google-client-secret"
```

### Email Sender Format

Emails are sent from: `{APP_NAME} <auth@{EMAIL_DOMAIN}>`

Example: `MyApp <auth@myapp.com>`

## Exported Functions

### `sendMagicLink`

Sends a magic link email for passwordless authentication.

### `sendVerificationEmail`

Sends an email verification link to new users.

### `sendPasswordReset`

Sends a password reset link.

## Usage

```typescript
import { api } from "@feel-good/convex";

// In your Convex mutation/action
await ctx.runAction(api.email.sendMagicLink, {
  to: "user@example.com",
  link: "https://yourapp.com/auth/verify?token=..."
});
```
