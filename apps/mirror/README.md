This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment Variables

Create a `.env.local` file in the root of this app with the following required variables:

```bash
# Site URL for authentication
NEXT_PUBLIC_SITE_URL="https://yourapp.com"

# Convex configuration
NEXT_PUBLIC_CONVEX_URL="https://your-deployment.convex.cloud"
NEXT_PUBLIC_CONVEX_SITE_URL="https://yourapp.com"
```

### Required Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SITE_URL` | Base URL for the application (used by auth client) |
| `NEXT_PUBLIC_CONVEX_URL` | URL of your Convex deployment |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Site URL for Convex auth integration |

### Sentry Variables (Optional)

Add these variables to enable Sentry error and tracing telemetry:

```bash
# Runtime SDK config (client + server + edge)
NEXT_PUBLIC_SENTRY_DSN="https://<public-key>@o0.ingest.sentry.io/<project-id>"
NEXT_PUBLIC_SENTRY_ENVIRONMENT="development"
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE="0.1"
SENTRY_RELEASE="mirror-local"
```

Optional build-time source map upload variables (usually set in CI/deployment):

```bash
SENTRY_AUTH_TOKEN="<sentry-auth-token>"
SENTRY_ORG="<sentry-org-slug>"
SENTRY_PROJECT="<sentry-project-slug>"
```

If `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, or `SENTRY_PROJECT` are missing, Mirror builds still succeed and source map upload is skipped.

### Sentry Verification Checklist

1. Run `pnpm dev --filter=@feel-good/mirror` with `NEXT_PUBLIC_SENTRY_DSN` set.
2. Trigger a client-side exception (for example, throw from a test button handler) and confirm issue ingestion in Sentry.
3. Trigger a server/request exception (for example, throw from a route handler) and confirm ingestion.
4. Run `pnpm build --filter=@feel-good/mirror`:
   - without upload vars to confirm non-failing skip behavior
   - with upload vars to confirm source map upload is enabled

Environment variables are validated at startup. Missing or invalid variables will cause clear error messages.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
