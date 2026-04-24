# CollectEase — Setup & Deployment Guide

## Prerequisites
- Node.js 18+
- A Supabase account (free tier works)
- A Vercel account (free tier works)
- Optional: Resend account for email, WhatsApp Business API

---

## Step 1 — Supabase Setup

1. Go to https://supabase.com and create a new project
2. Wait for the project to initialize
3. Go to **SQL Editor** → paste the entire contents of `supabase/schema.sql` → Run
4. Go to **Authentication** → **Providers** → ensure Email is enabled
5. Go to **Project Settings** → **API** → copy:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - Anon public key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Service role key (`SUPABASE_SERVICE_ROLE_KEY`)

---

## Step 2 — Local Development

```bash
cd collectease

# Copy env file and fill in values
cp .env.example .env.local

# Install dependencies (already done if you cloned)
npm install

# Start dev server
npm run dev
```

Open http://localhost:3000 — you'll be redirected to /auth/login.

Register a new account, then start adding clients and invoices.

---

## Step 3 — Email Setup (Resend)

1. Sign up at https://resend.com
2. Add and verify your domain
3. Create an API key
4. Set in `.env.local`:
   ```
   RESEND_API_KEY=re_xxxxx
   BREVO_API_KEY=your_brevo_api_key
   EMAIL_FROM=SIRPL <accounts@sirpl.in>
   BREVO_FROM_EMAIL=accounts@sirpl.in
   TRANSPORT_EMAIL_FROM=SIRPL Transport Department <accounts@sirpl.in>
   TRANSPORT_BREVO_FROM_EMAIL=accounts@sirpl.in
   TRANSPORT_FROM_NAME=SIRPL Transport Department
   ```

Without this, emails are mocked and logged to console.

If you want transport notifications to come from a separate mailbox, make sure that mailbox is verified with your email provider first. Otherwise keep the transport sender pointed at the same verified `accounts@sirpl.in` address.

---

## Step 4 — WhatsApp Setup (Optional)

1. Set up Meta Business Account + WhatsApp Business API
2. Get your Phone Number ID and Access Token
3. Set in `.env.local`:
   ```
   WHATSAPP_PHONE_NUMBER_ID=1234567890
   WHATSAPP_ACCESS_TOKEN=EAAxxxxx
   WHATSAPP_API_URL=https://graph.facebook.com/v18.0
   ```

Without this, WhatsApp messages are mocked and logged to console.

---

## Step 5 — Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Or connect your GitHub repository directly at vercel.com.

### Set Environment Variables in Vercel:
In your Vercel project → Settings → Environment Variables, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `BREVO_API_KEY`
- `EMAIL_FROM`
- `BREVO_FROM_EMAIL`
- `BREVO_FROM_NAME`
- `TRANSPORT_EMAIL_FROM`
- `TRANSPORT_BREVO_FROM_EMAIL`
- `TRANSPORT_FROM_NAME`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `NEXT_PUBLIC_APP_URL` (your Vercel URL)
- `CRON_SECRET` (any random secret, e.g., `openssl rand -hex 32`)

---

## Step 6 — Automated Reminders (Cron)

The cron job runs daily at 9 AM IST via Vercel Cron (configured in `vercel.json`).

It:
1. Marks overdue invoices (past due date)
2. Sends reminders based on aging schedule:
   - Day 0 → Friendly reminder on invoice creation
   - Day 7 → Firm reminder
   - Day 15 → Final warning
   - Day 25+ → Legal escalation notice

**The cron endpoint is:** `GET /api/cron/run`  
Protected by `Authorization: Bearer <CRON_SECRET>` header.

To test manually:
```bash
curl -H "Authorization: Bearer your_cron_secret" https://your-app.vercel.app/api/cron/run
```

---

## Folder Structure

```
collectease/
├── src/
│   ├── app/
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── callback/route.ts
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              ← Main dashboard
│   │   │   ├── invoices/
│   │   │   │   ├── page.tsx          ← Invoice list
│   │   │   │   └── new/page.tsx      ← Create invoice
│   │   │   ├── clients/page.tsx      ← Client list + risk scores
│   │   │   ├── reports/page.tsx      ← Reports + export
│   │   │   └── settings/page.tsx     ← Business settings
│   │   └── api/
│   │       ├── invoices/route.ts
│   │       ├── clients/route.ts
│   │       ├── payments/route.ts
│   │       ├── reminders/route.ts
│   │       ├── businesses/route.ts
│   │       ├── documents/route.ts    ← PDF generation
│   │       └── cron/run/route.ts     ← Automation engine
│   ├── components/
│   │   ├── ui/                       ← Design system
│   │   ├── layout/                   ← Sidebar, page header
│   │   ├── dashboard/                ← Charts
│   │   ├── invoices/                 ← Invoice forms + actions
│   │   ├── clients/                  ← Client dialogs
│   │   ├── reports/                  ← Export buttons
│   │   └── settings/                 ← Settings form
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             ← Browser client
│   │   │   └── server.ts             ← Server + service client
│   │   ├── messaging.ts              ← WhatsApp + Email
│   │   ├── pdf.ts                    ← PDF generation
│   │   └── utils.ts                  ← Helpers
│   ├── types/index.ts
│   └── proxy.ts                      ← Auth middleware
├── supabase/
│   └── schema.sql                    ← Full DB schema
├── vercel.json                       ← Cron config
└── .env.example
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List invoices |
| POST | `/api/invoices` | Create invoice |
| PATCH | `/api/invoices` | Update invoice |
| GET | `/api/clients` | List clients |
| POST | `/api/clients` | Create client |
| POST | `/api/payments` | Record payment |
| POST | `/api/reminders` | Send manual reminder |
| GET | `/api/documents?type=invoice&invoiceId=xxx` | Download invoice PDF |
| GET | `/api/documents?type=legal_notice&invoiceId=xxx` | Download legal notice PDF |
| GET | `/api/documents?type=msme_complaint&invoiceId=xxx` | Download MSME complaint draft |
| GET | `/api/documents?type=report_csv` | Export all invoices as CSV |
| GET | `/api/documents?type=report_pdf` | Export report as PDF |
| GET | `/api/cron/run` | Run automation (cron) |
| PATCH | `/api/businesses` | Update business profile |

---

## Features Summary

- **Auth**: Email/password login + register with business profile
- **Invoices**: Create, list, filter, mark paid, download PDF
- **Clients**: Add, track risk score (Good/Moderate/Risky), view outstanding
- **Reminders**: Auto + manual — via WhatsApp + Email
- **Escalation**: Legal notice PDF, MSME Samadhaan complaint draft
- **Reports**: Aging analysis, collection efficiency, CSV + PDF export
- **Dashboard**: Real-time stats, 6-month collection chart, aging buckets
- **Cron**: Daily automation at 9 AM IST via Vercel Cron

---

## Tally / Vyapar CSV Import (Bonus)

To import invoices from Tally or Vyapar CSV:
- Go to Invoices → (coming: CSV upload button)
- Map columns: Client Name, Invoice Number, Amount, Due Date
- System will auto-create clients if not found

The CSV endpoint structure is compatible with standard Tally export formats.
