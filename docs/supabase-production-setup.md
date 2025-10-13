# Supabase Production Setup Guide

This guide walks you through setting up a production Supabase project and connecting your application to it.

## Prerequisites

- Supabase CLI installed (`pnpm` is configured in this project)
- A Vercel account (for deployment)
- Google OAuth credentials (if using Google login)

## Step 1: Create a Supabase Project

1. **Go to Supabase Dashboard**
   - Visit [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Sign in or create an account

2. **Create a New Project**
   - Click "New Project"
   - Fill in the details:
     - **Organization**: Select or create an organization
     - **Name**: Choose a name for your project (e.g., "design-project-prod")
     - **Database Password**: Generate a strong password (save this securely!)
     - **Region**: Choose the region closest to your users
     - **Pricing Plan**: Select Free or Pro based on your needs
   - Click "Create new project"
   - Wait 2-3 minutes for the project to be provisioned

3. **Save Your Project Credentials**
   - Once created, go to **Settings > API**
   - Copy and save these values (you'll need them later):
     - **Project URL** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
     - **anon/public key** (starts with `eyJ...`)
     - **service_role key** (starts with `eyJ...`) - Keep this secret!

## Step 2: Link Local Project to Production

1. **Authenticate Supabase CLI**
   ```bash
   npx supabase login
   ```
   - This will open a browser window
   - Authorize the CLI to access your account

2. **Link Your Local Project**
   ```bash
   npx supabase link --project-ref <project-ref>
   ```
   - Replace `<project-ref>` with your project reference ID
   - Find the project ref in your Supabase dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`
   - When prompted, enter your database password (from Step 1.2)

3. **Verify the Link**
   ```bash
   npx supabase status --linked
   ```
   - This should show your production database information

## Step 3: Deploy Database Schema

1. **Review Your Migrations**
   - Check what will be deployed:
   ```bash
   ls -la supabase/migrations/
   ```
   - You should see:
     - `20250729031644_profile_creation.sql`
     - `20250926150720_create_files_table.sql`
     - `20250926165848_create_storage_bucket_and_policies.sql`

2. **Deploy Migrations to Production**
   ```bash
   pnpm supabase:deploy
   ```
   - Or manually:
   ```bash
   npx supabase db push
   ```
   - This will apply all migrations to your production database
   - Confirm when prompted

3. **Verify Tables Were Created**
   - Go to Supabase Dashboard > **Table Editor**
   - You should see:
     - `profiles` table
     - `files` table

4. **Verify Storage Bucket Was Created**
   - Go to Supabase Dashboard > **Storage**
   - You should see a `documents` bucket
   - Click on it and verify:
     - **Public**: No (private bucket)
     - **File size limit**: 50MB
     - **Allowed MIME types**: PDF, DOCX, images, etc.

5. **Verify Storage Policies**
   - In the Storage section, click on the `documents` bucket
   - Go to **Policies** tab
   - You should see 4 policies:
     - "Authenticated users can upload documents"
     - "Users can view their own documents"
     - "Users can update their own documents"
     - "Users can delete their own documents"

## Step 4: Configure Production Environment Variables

### For Vercel Deployment

1. **Go to Your Vercel Project**
   - Visit [https://vercel.com/dashboard](https://vercel.com/dashboard)
   - Select your project

2. **Add Environment Variables**
   - Go to **Settings > Environment Variables**
   - Add the following variables (use the values from Step 1.3):

   | Name | Value | Environment |
   |------|-------|-------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxxxxxxxxxx.supabase.co` | Production, Preview, Development |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (your anon key) | Production, Preview, Development |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (your service role key) | Production, Preview, Development |
   | `NEXT_PUBLIC_URL` | `https://your-domain.vercel.app` | Production |

3. **Add Google OAuth Variables (if using)**
   - If you're using Google OAuth, also add:

   | Name | Value | Environment |
   |------|-------|-------------|
   | `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | Your Google Client ID | Production, Preview, Development |
   | `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | Your Google Client Secret | Production, Preview, Development |

4. **Save and Redeploy**
   - Click "Save"
   - Trigger a new deployment or wait for the next git push

## Step 5: Configure Google OAuth in Production (Optional)

If you're using Google sign-in, you need to configure it in Supabase:

1. **Go to Supabase Dashboard**
   - Navigate to **Authentication > Providers**
   - Find "Google" and click to configure

2. **Enable Google Provider**
   - Toggle "Enable Google Provider" to ON
   - Enter your credentials:
     - **Client ID**: From Google Cloud Console
     - **Client Secret**: From Google Cloud Console

3. **Configure Google Cloud Console**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Select your project
   - Go to **APIs & Services > Credentials**
   - Click on your OAuth 2.0 Client ID
   - Add your Supabase callback URL to **Authorized redirect URIs**:
     ```
     https://xxxxxxxxxxxxx.supabase.co/auth/v1/callback
     ```
   - Add your app URL:
     ```
     https://your-domain.vercel.app
     ```
   - Click "Save"

4. **Configure Supabase Auth Settings**
   - In Supabase Dashboard, go to **Authentication > URL Configuration**
   - Set **Site URL**: `https://your-domain.vercel.app`
   - Add **Redirect URLs** (one per line):
     ```
     https://your-domain.vercel.app
     https://your-domain.vercel.app/dashboard
     https://your-domain.vercel.app/auth/callback
     ```

## Step 6: Update Local Development (Optional)

If you want to keep using local Supabase for development:

1. **Keep Two Environment Files**
   - Keep `.env.local` with local Supabase settings
   - Create `.env.production.local` with production settings (optional)

2. **Or Switch to Production for Local Dev**
   - Update `.env.local` to use production values:
   ```bash
   # .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

## Step 7: Verify Production Setup

1. **Test the Application**
   - Visit your production URL: `https://your-domain.vercel.app`
   - Try signing up or logging in
   - Upload a file to test storage

2. **Check Vercel Logs**
   - Go to your Vercel project > **Deployments**
   - Click on the latest deployment
   - Check **Functions** tab for any errors
   - Look for middleware errors (should be gone now!)

3. **Check Supabase Logs**
   - Go to Supabase Dashboard > **Logs**
   - Monitor for any errors or issues

4. **Verify File Upload**
   - Log in to your app
   - Go to Files section
   - Try uploading a file
   - Go to Supabase Dashboard > **Storage > documents**
   - You should see a folder with your user ID containing the uploaded file

## Troubleshooting

### Error: "MIDDLEWARE_INVOCATION_FAILED"
- **Cause**: Missing or incorrect Supabase environment variables in Vercel
- **Solution**: Double-check all env vars in Vercel settings, especially `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Error: "Bucket not found"
- **Cause**: Storage bucket wasn't created in production
- **Solution**: Run `pnpm supabase:deploy` again or manually create the bucket in Supabase Dashboard

### Error: "New row violates row-level security policy"
- **Cause**: RLS policies weren't applied correctly
- **Solution**:
  1. Go to Supabase Dashboard > **Table Editor**
  2. Click on the table > **RLS disabled** warning
  3. Enable RLS and verify policies exist

### File Upload Fails with "403 Forbidden"
- **Cause**: Storage policies not applied or user folder structure incorrect
- **Solution**: Check storage policies in Supabase Dashboard > Storage > documents > Policies

### Google OAuth Not Working
- **Cause**: Redirect URLs not configured correctly
- **Solution**:
  1. Verify callback URL in Google Cloud Console
  2. Verify redirect URLs in Supabase Dashboard > Authentication > URL Configuration

## Next Steps

1. **Set Up Row Level Security (RLS)**
   - Review all RLS policies in production
   - Test with different user accounts

2. **Configure Email Templates**
   - Customize auth emails in Supabase Dashboard > Authentication > Email Templates

3. **Set Up Backups**
   - Configure automated backups in Supabase Dashboard > Settings > Backups

4. **Monitor Usage**
   - Keep an eye on storage usage, API requests, and database size

5. **Set Up Alerts**
   - Configure email alerts for critical errors in Vercel and Supabase

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/guides/cli)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

## Quick Reference Commands

```bash
# Link to production
npx supabase link --project-ref <project-ref>

# Check link status
npx supabase status --linked

# Deploy migrations
pnpm supabase:deploy
# or
npx supabase db push

# Generate TypeScript types from production
pnpm supabase:types
# or
npx supabase gen types typescript --linked > types/database.types.ts

# Reset local database (development only!)
pnpm supabase:reset
```

## Important Notes

- Never commit your `.env.local` or `.env.production` files to git
- Keep your `SUPABASE_SERVICE_ROLE_KEY` secure - it bypasses all RLS policies
- Always test migrations locally before deploying to production
- Use Supabase Dashboard to manually verify database changes after deployment
