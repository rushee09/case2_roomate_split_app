# Pocket — Roommate Expense Splitter

Split shared expenses with roommates. Track who paid, who owes what, and settle up with the minimum number of transactions.

---

## Features

- Google OAuth sign-in via NextAuth.js
- Unique username setup on first login (onboarding flow)
- Create groups with currency support: INR, USD, EUR, GBP, AED
- Add expenses with equal, percentage, or exact-amount splits
- Optional expense metadata: category, notes, receipt URL, recurring schedule
- Balance engine with minimum-transaction settlement suggestions
- Settlement workflow with payment method selection (Cash, UPI, Bank Transfer, Card) and optional proof/reference
- Settlement confirmation flow — payee must confirm or reject a recorded payment
- In-app notification bell for settlement events (recorded, confirmed, rejected, reminder)
- Automated daily cron reminder for settlements pending confirmation > 15 days
- Activity log per group (expenses added, members joined, settlements recorded)
- Invite members by email — tokenized links with accept/decline
- Join groups via shareable invite code
- Export group data
- Full unit-test suite for balance calculations and money utilities

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Radix UI |
| Auth | NextAuth.js v4, Google OAuth, `@auth/prisma-adapter` |
| Backend | FastAPI (Python 3.11), proxied through Next.js API routes |
| Database | PostgreSQL via Supabase (pgbouncer + direct URL) |
| ORM | Prisma (Next.js side) + SQLAlchemy (FastAPI side) |
| Email | Nodemailer, Gmail SMTP |
| Testing | Vitest + `@vitejs/plugin-react` |
| Deploy | Netlify (frontend) + Supabase (database) + Railway/Render (backend) |

---

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.11+
- A Google Cloud project with OAuth 2.0 credentials
- A Gmail account with an [App Password](https://support.google.com/accounts/answer/185833)
- A Supabase project (or any PostgreSQL instance)

### 1. Install dependencies

```bash
git clone <repo-url>
cd case2_roomate_split_app
npm install
```

> `prisma generate` runs automatically via the `postinstall` script.

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
# Database (Supabase — use Transaction pooler URL for DATABASE_URL)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""   # node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# FastAPI backend
FASTAPI_URL="http://localhost:8000"

# Gmail SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="<your-gmail>"
SMTP_PASS="<gmail-app-password>"

# Cron protection (optional — required for settlement reminder cron)
CRON_SECRET=""

# Public
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="Pocket"
```

### 3. Set up the database

```bash
npx prisma migrate dev
```

### 4. Install Python backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 5. Start both servers

**Terminal 1 — Backend** (FastAPI on port 8000):
```bash
.\start-backend.bat
```

**Terminal 2 — Frontend** (Next.js on port 3000):
```bash
.\start-frontend.bat
```

Or run them manually:
```bash
# backend
cd backend && uvicorn main:app --reload --port 8000

# frontend
npm run dev
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add Authorized Redirect URI:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://<your-netlify-domain>/api/auth/callback/google`
4. Copy the **Client ID** and **Client Secret** into `.env`

---

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js in development mode |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:migrate:prod` | Deploy migrations to production |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset DB and re-seed |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:ui` | Open Vitest UI |

---

## Deployment

### Database — Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database → Connection string**
3. Copy both the **Transaction pooler** URL (port 6543) → `DATABASE_URL` and the **Direct** URL (port 5432) → `DIRECT_URL`
4. Run migrations: `npx prisma migrate deploy`

### Frontend — Netlify

1. Push the repo to GitHub
2. Connect in [Netlify](https://netlify.com) → **New site from Git**
3. Build command: `npx prisma generate && npm run build`
4. Publish directory: `.next`
5. Add all `.env` variables under **Site settings → Environment variables**
6. Set `NEXTAUTH_URL` to your Netlify domain

The `netlify.toml` and `@netlify/plugin-nextjs` are pre-configured.

### Backend — FastAPI

Deploy to Railway, Render, or Fly.io:

```bash
# Railway example
railway init
railway up
```

Set `FASTAPI_URL` in your Netlify environment variables to the deployed backend URL. The frontend proxies all `/api/py/*` calls to FastAPI.

### Settlement Reminder Cron

`GET /api/cron/settlement-reminders` sends in-app reminders for settlements that have been `PENDING_CONFIRMATION` for more than 15 days. Protect it with `CRON_SECRET` and schedule it to run daily.

Example Vercel cron config (`vercel.json`):
```json
{ "crons": [{ "path": "/api/cron/settlement-reminders?secret=<CRON_SECRET>", "schedule": "0 9 * * *" }] }
```

---

## Project Structure

```
├── app/                        # Next.js App Router
│   ├── api/
│   │   ├── auth/[...nextauth]/ # NextAuth handler
│   │   ├── cron/
│   │   │   └── settlement-reminders/ # Daily reminder cron
│   │   ├── groups/             # Group CRUD + sub-resources
│   │   │   └── [groupId]/
│   │   │       ├── activity/
│   │   │       ├── balances/
│   │   │       ├── expenses/
│   │   │       │   └── [expenseId]/
│   │   │       ├── export/
│   │   │       ├── members/
│   │   │       └── settlements/
│   │   │           └── [settlementId]/
│   │   ├── invitations/        # Email invitation flow
│   │   ├── join/               # Join via invite code
│   │   ├── notifications/      # In-app notifications
│   │   └── users/              # Current user + search
│   ├── dashboard/              # Main dashboard page
│   ├── groups/
│   │   ├── [groupId]/          # Group detail view
│   │   └── new/                # Create group
│   ├── invitations/[token]/    # Accept / decline invite
│   ├── join/                   # Join by code UI
│   ├── login/                  # Google sign-in
│   └── onboarding/             # Username setup
├── backend/                    # FastAPI application
│   ├── main.py
│   └── app/
│       ├── balance.py          # Balance + settlement engine (Python)
│       ├── models.py           # SQLAlchemy models
│       ├── database.py
│       └── routers/            # groups, users, invitations, join
├── components/                 # React components
│   ├── ActivityTab.tsx
│   ├── AddExpenseModal.tsx
│   ├── AddMemberModal.tsx
│   ├── BalancesTab.tsx
│   ├── ExpensesTab.tsx
│   ├── NotificationBell.tsx
│   ├── SettlementsTab.tsx
│   ├── SettleUpModal.tsx
│   └── ui/                     # button, toast, toaster
├── lib/                        # Shared utilities
│   ├── auth.ts                 # NextAuth config
│   ├── balance.ts              # Balance engine (TypeScript)
│   ├── db.ts                   # Prisma client singleton
│   ├── email_service.ts        # Email helpers
│   ├── mail.ts                 # Nodemailer config
│   ├── money.ts                # Paise conversion + formatting
│   ├── proxy.ts                # FastAPI proxy helper
│   ├── utils.ts                # Shared utilities
│   └── validations.ts          # Zod schemas
├── prisma/
│   ├── schema.prisma           # DB schema
│   └── migrations/
├── tests/
│   └── balance.test.ts         # Vitest unit tests
└── types/
    └── next-auth.d.ts          # Session type augmentation
```

---

## Data Models

| Model | Purpose |
|-------|---------|
| `User` | NextAuth-compatible user, with optional `username` |
| `Account` / `Session` | NextAuth OAuth tables |
| `Group` | Expense group with currency and invite code |
| `Member` | Group participant; optionally linked to a `User` |
| `Expense` | A paid expense with splits, optional category, notes, receipt, and recurring schedule |
| `ExpenseSplit` | Per-member share of an expense (paise) |
| `Settlement` | A recorded payment between two members; tracks payment method, reference, proof, and confirmation status (`PENDING_CONFIRMATION / CONFIRMED / REJECTED`) |
| `Activity` | Immutable audit log entry for a group |
| `Notification` | In-app notification for settlement events (`SETTLEMENT_RECORDED / SETTLEMENT_CONFIRMED / SETTLEMENT_REJECTED / SETTLEMENT_REMINDER`) |
| `GroupInvitation` | Tokenized email invite (`PENDING / ACCEPTED / DECLINED / EXPIRED`) |

---

## Money Handling

All monetary values are stored as **integer paise** (smallest unit) to eliminate floating-point rounding errors.

```
₹1,200.50  →  120050 paise  (stored in DB)
120050     →  ₹1,200.50     (formatted for display)
```

Helpers in `lib/money.ts`: `toPaise()`, `toINR()`, `formatCurrency()`, `formatCurrencyShort()`, `calcEqualSplits()`, `calcPercentageSplits()`, `validateExactSplits()`.

