#!/bin/bash
# Sync Convex coords from packages/convex/.env.local into apps/mirror/.env.local
# for the current worktree.
#
# Run after `./scripts/provision-worktree-convex.sh` writes this worktree's
# packages/convex/.env.local.
#
# Idempotent: rewrites the three CONVEX_* lines in apps/mirror/.env.local
# in place; everything else (Sentry, Tavus, Anthropic, Better Auth) is preserved.

set -e

GIT_ROOT=$(git rev-parse --show-toplevel)
CONVEX_ENV="$GIT_ROOT/packages/convex/.env.local"
APP_ENV="$GIT_ROOT/apps/mirror/.env.local"

[[ -f "$CONVEX_ENV" ]] || { echo "Error: $CONVEX_ENV not found. Run \`./scripts/provision-worktree-convex.sh\` first." >&2; exit 1; }
[[ -f "$APP_ENV"    ]] || { echo "Error: $APP_ENV not found." >&2; exit 1; }

# Bail loudly if apps/mirror/.env.local is still a symlink. A successful
# sed -i would clobber the symlink target (main's canonical file), which
# is the cross-worktree corruption mode this whole change is fixing.
if [[ -L "$APP_ENV" ]]; then
  echo "Error: $APP_ENV is a symlink — refusing to write." >&2
  echo "       Replace with a copy first:" >&2
  echo "         rm $APP_ENV && cp \$(readlink $APP_ENV) $APP_ENV" >&2
  echo "       (Or run new-worktree.sh in this branch from a fresh worktree.)" >&2
  exit 1
fi

# Convex CLI writes bare KEY=value lines (no quoting), so grep | cut works.
DEPLOYMENT=$(grep '^CONVEX_DEPLOYMENT=' "$CONVEX_ENV" | head -n1 | cut -d= -f2- | awk '{print $1}')
URL=$(grep        '^CONVEX_URL='        "$CONVEX_ENV" | head -n1 | cut -d= -f2-)
SITE_URL=$(grep   '^CONVEX_SITE_URL='   "$CONVEX_ENV" | head -n1 | cut -d= -f2-)

# Strip trailing slashes — @convex-dev/better-auth's Next.js adapter does
# `${siteUrl}${pathname}`, so `https://x.convex.site/` + `/api/auth/get-session`
# becomes `//api/auth/get-session` and Convex 404s.
URL="${URL%/}"
SITE_URL="${SITE_URL%/}"

[[ -n "$DEPLOYMENT" && -n "$URL" && -n "$SITE_URL" ]] || {
  echo "Error: $CONVEX_ENV missing one of CONVEX_DEPLOYMENT / CONVEX_URL / CONVEX_SITE_URL." >&2
  exit 1
}

APP_ENV_TMP=$(mktemp)
trap 'rm -f "$APP_ENV_TMP"' EXIT
cp -p "$APP_ENV" "$APP_ENV_TMP"

awk \
  -v deployment="$DEPLOYMENT" \
  -v url="$URL" \
  -v site_url="$SITE_URL" \
  '
    /^CONVEX_DEPLOYMENT=/ {
      print "CONVEX_DEPLOYMENT=" deployment
      next
    }
    /^NEXT_PUBLIC_CONVEX_URL=/ {
      print "NEXT_PUBLIC_CONVEX_URL=" url
      next
    }
    /^NEXT_PUBLIC_CONVEX_SITE_URL=/ {
      print "NEXT_PUBLIC_CONVEX_SITE_URL=" site_url
      next
    }
    { print }
  ' "$APP_ENV" > "$APP_ENV_TMP"

mv "$APP_ENV_TMP" "$APP_ENV"

echo "Updated $APP_ENV with this worktree's Convex coords:"
echo "  CONVEX_DEPLOYMENT=$DEPLOYMENT"
echo "  NEXT_PUBLIC_CONVEX_URL=$URL"
echo "  NEXT_PUBLIC_CONVEX_SITE_URL=$SITE_URL"
