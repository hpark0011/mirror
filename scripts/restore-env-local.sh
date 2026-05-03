#!/usr/bin/env bash
# Rebuild apps/mirror/.env.local from authoritative sources after a clobber.
#
# Sources:
#   - packages/convex/.env.local                   -> CONVEX_DEPLOYMENT (+ derived URLs)
#   - vercel env pull --environment=production     -> NEXT_PUBLIC_SENTRY_DSN, TAVUS_*
#
# Convex-side secrets (BETTER_AUTH_SECRET, GOOGLE_*, RESEND_API_KEY,
# ANTHROPIC_API_KEY, PLAYWRIGHT_TEST_SECRET) live in Convex env, not
# .env.local — see apps/mirror/.env.local.example. If a local script
# needs them, copy values manually from `npx convex env list`.
#
# Excludes CONVEX_DEPLOY_KEY (would route convex CLI to prod —
# see .claude/rules/auth.md).

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
APP_ENV="$ROOT/apps/mirror/.env.local"
CONVEX_LOCAL="$ROOT/packages/convex/.env.local"

if [[ ! -f "$CONVEX_LOCAL" ]]; then
  echo "error: $CONVEX_LOCAL missing — run \`pnpm --filter=@feel-good/convex dev\` once to seed it." >&2
  exit 1
fi

CONVEX_DEPLOYMENT="$(grep -E '^CONVEX_DEPLOYMENT=' "$CONVEX_LOCAL" | head -1 | cut -d'=' -f2 | awk '{print $1}')"
if [[ -z "$CONVEX_DEPLOYMENT" ]]; then
  echo "error: could not parse CONVEX_DEPLOYMENT from $CONVEX_LOCAL" >&2
  exit 1
fi
DEPLOY_NAME="${CONVEX_DEPLOYMENT#dev:}"
DEPLOY_NAME="${DEPLOY_NAME#prod:}"
CONVEX_URL="https://${DEPLOY_NAME}.convex.cloud"
CONVEX_SITE="https://${DEPLOY_NAME}.convex.site"

# Backup whatever is there now (resolve through symlink so we capture canonical content).
if [[ -e "$APP_ENV" ]]; then
  STAMP="$(date +%s)"
  TARGET="$(readlink -f "$APP_ENV" 2>/dev/null || echo "$APP_ENV")"
  cp "$TARGET" "${APP_ENV}.bak.${STAMP}"
  echo "backup: ${APP_ENV}.bak.${STAMP}"
fi

# Pull Vercel production env to a temp file. Requires apps/mirror to be linked.
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
if ! (cd "$ROOT/apps/mirror" && vercel env pull --environment=production --yes "$TMP" >/dev/null 2>&1); then
  echo "warn: vercel env pull failed — Sentry/Tavus values will be missing. Run \`vercel link\` once, then re-run." >&2
  : > "$TMP"
fi

# Compose the new file.
{
  echo "# Restored by scripts/restore-env-local.sh"
  echo "# Convex (dev)"
  echo "CONVEX_DEPLOYMENT=${CONVEX_DEPLOYMENT}"
  echo "NEXT_PUBLIC_CONVEX_URL=${CONVEX_URL}"
  echo "NEXT_PUBLIC_CONVEX_SITE_URL=${CONVEX_SITE}"
  echo
  echo "# Site"
  echo "NEXT_PUBLIC_SITE_URL=http://localhost:3000"
  echo
  echo "# Sentry (DSN from Vercel; env+sample-rate fixed for dev)"
  if grep -qE '^NEXT_PUBLIC_SENTRY_DSN=' "$TMP"; then
    grep -E '^NEXT_PUBLIC_SENTRY_DSN=' "$TMP" | head -1
  else
    echo "# NEXT_PUBLIC_SENTRY_DSN= (not in Vercel production env)"
  fi
  echo "NEXT_PUBLIC_SENTRY_ENVIRONMENT=development"
  echo "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1"
  echo
  echo "# Tavus"
  grep -E '^TAVUS_API_KEY=' "$TMP" | head -1 || echo "# TAVUS_API_KEY= (not in Vercel production env)"
  grep -E '^TAVUS_PERSONA_ID=' "$TMP" | head -1 || echo "# TAVUS_PERSONA_ID= (not in Vercel production env)"
  echo
  echo "# Convex-side secrets (BETTER_AUTH_SECRET, GOOGLE_*, RESEND_API_KEY,"
  echo "# ANTHROPIC_API_KEY, PLAYWRIGHT_TEST_SECRET) live in Convex env."
  echo "# View them with: \`pnpm --filter=@feel-good/convex exec convex env list\`"
} > "$APP_ENV"

# Count restored keys (don't echo values).
COUNT="$(grep -cE '^[A-Z_]+=' "$APP_ENV" || true)"
echo "wrote $APP_ENV (${COUNT} keys)"
