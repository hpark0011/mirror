# Google OAuth "Continue with Google" Error - Investigation

## Root Cause

**Error**: `Access blocked: Authorization Error - The OAuth client was deleted`
- Error Code: 401 `deleted_client`
- Client ID: `621347438947-803t7s4cnvkb63b8mbopjnkb8oop3urd.apps.googleusercontent.com`

The Google OAuth client credentials stored in Convex environment variables have been **deleted from Google Cloud Console**.

---

## Where Credentials Are Configured

| Location | Purpose |
|----------|---------|
| Convex Dashboard → Environment Variables | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` |
| `packages/convex/convex/auth.ts:33-34` | Reads credentials via `env.GOOGLE_CLIENT_ID` |

---

## Solution: Create New Google OAuth Credentials

### Step 1: Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Choose **Web application**
6. Configure:
   - **Name**: Mirror Auth (or your preferred name)
   - **Authorized JavaScript origins**:
     - `http://localhost:3001` (dev)
     - Your production domain
   - **Authorized redirect URIs**:
     - `http://localhost:3001/api/auth/callback/google` (dev)
     - `https://yourdomain.com/api/auth/callback/google` (prod)
7. Copy the **Client ID** and **Client Secret**

### Step 2: Update Convex Environment Variables

```bash
npx convex env set GOOGLE_CLIENT_ID "your-new-client-id"
npx convex env set GOOGLE_CLIENT_SECRET "your-new-client-secret"
```

Or update via the Convex Dashboard under **Settings → Environment Variables**.

---

## Verification

After updating credentials:
1. Restart dev server: `pnpm dev --filter=@feel-good/mirror`
2. Navigate to `/sign-up`
3. Click "Continue with Google"
4. Should redirect to Google's consent screen instead of error page

---

## No Code Changes Required

This is a **configuration issue only** - no code changes needed.
