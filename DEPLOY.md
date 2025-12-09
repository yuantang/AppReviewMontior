
# App Store Monitor System - Deployment & Configuration Guide

This system uses **React (Vite)** for the frontend, **Vercel Serverless Functions** for the backend, and **Supabase** for the database.

---

## 1. Supabase Setup

1. Create a new Supabase Project.
2. Go to **SQL Editor** and paste the content from `supabase/schema.sql` to create the tables (`apps`, `reviews`).
3. Go to **Project Settings -> API**.
4. Copy the following keys:
   - `Project URL`
   - `anon` public key (for Frontend read access)
   - `service_role` secret key (for Backend write access)

---

## 2. Apple App Store Connect Setup

1. Go to [App Store Connect -> Users and Access -> Integrations](https://appstoreconnect.apple.com/access/integrations/api).
2. Generate a new API Key with **App Manager** access.
3. Download the `.p8` Private Key file.
4. Note down the **Issuer ID** and **Key ID**.

---

## 3. Vercel Configuration (Environment Variables)

When deploying to Vercel, go to **Settings -> Environment Variables** and add the following:

### Frontend Variables (Exposed to Browser)
| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase `anon` key |

### Backend Variables (Server Only - Secure)
| Name | Value |
|------|-------|
| `SUPABASE_SERVICE_KEY` | Your Supabase `service_role` key |
| `GEMINI_API_KEY` | Your Google Gemini API Key |
| `APP_STORE_ISSUER_ID` | Your Apple Issuer ID |
| `APP_STORE_KEY_ID` | Your Apple Key ID |
| `APP_STORE_PRIVATE_KEY` | The content of your `.p8` file. **Important**: Since Vercel env vars are single strings, you may need to replace newlines with `\n` literal or handle it in code. (The code is set up to handle standard copy-paste). |
| `CRON_SECRET` | A random strong string (e.g., `x8z9-secure-cron-token`). This protects your `/api/cron` endpoint. |

---

## 4. Automation (Cron Jobs)

Since Vercel's free plan limits Cron Jobs, we use **GitHub Actions** to automate the sync process for free.

### Setup GitHub Actions:

1. Push your code to a GitHub repository.
2. Go to your repository **Settings -> Secrets and variables -> Actions**.
3. Add the following **Repository Secrets**:

| Name | Value |
|------|-------|
| `VERCEL_PROJECT_DOMAIN` | Your deployed Vercel domain (e.g., `app-monitor.vercel.app`) - **Do not include https://** |
| `CRON_SECRET` | The same `CRON_SECRET` you set in Vercel. |

4. The workflow in `.github/workflows/scheduler.yml` is configured to run **every hour**. You can edit the file to change the frequency (e.g., `*/10 * * * *` for every 10 minutes).

### Alternative: Manual Trigger

- Log in to your deployed app as an Admin.
- Go to **Settings**.
- Click **"Sync Now"**. This securely triggers the sync process.

---

## 5. Local Development

To run locally with full features, create a `.env` file in the root:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
GEMINI_API_KEY=...
APP_STORE_ISSUER_ID=...
APP_STORE_KEY_ID=...
APP_STORE_PRIVATE_KEY=...
```

Then run:
`npm run dev`
