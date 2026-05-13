# Pocket — Roommate Expense Splitter

Split shared expenses with roommates. Track who paid, who owes what, and settle up with minimal transactions.

---

## Features

- Google OAuth sign-in (NextAuth.js)
- Unique usernames — invite roommates by searching their username
- Email invitations via Gmail SMTP
- Group creation with AED, INR, USD, EUR, GBP support
- Add expenses with equal, percentage, or exact splits
- Balance calculation with minimum-transaction settlement suggestions
- Activity log per group
- Join groups via invite code or email link

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Auth | NextAuth.js v4, Google OAuth, PrismaAdapter |
| Backend | FastAPI (Python), exposed via Next.js proxy routes |
| Database | SQLite locally → Supabase (PostgreSQL) in production |
| ORM | Prisma (Next.js) + SQLAlchemy (FastAPI) |
| Email | Nodemailer (Gmail SMTP) |
| Deploy | Netlify (frontend) + Supabase (database) |

---

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- A Google Cloud project with OAuth credentials
- A Gmail account with an App Password

### 1. Clone and install

```bash
git clone <repo-url>
cd case2_roomate_split_app
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\">"

GOOGLE_CLIENT_ID="<from Google Cloud Console>"
GOOGLE_CLIENT_SECRET="<from Google Cloud Console>"

FASTAPI_URL="http://localhost:8000"

SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="<your-gmail>"
SMTP_PASS="<gmail-app-password>"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="Pocket"
```

### 3. Set up database

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Install Python backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 5. Start both servers

**Terminal 1 — Backend:**
```bash
.\start-backend.bat
# FastAPI runs on http://localhost:8000
```

**Terminal 2 — Frontend:**
```bash
.\start-frontend.bat
# Next.js runs on http://localhost:3000
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → APIs & Services → Credentials → OAuth 2.0 Client ID
3. Add Authorized Redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID and Client Secret into `.env`

---

## Deployment (Supabase + Netlify)

### Database — Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Copy the **Connection String** (Transaction pooler, port 6543)
3. Set `DATABASE_URL` in your production environment to the Supabase connection string
4. Run: `npx prisma migrate deploy`

### Frontend — Netlify
1. Push repo to GitHub
2. Connect repo in [Netlify](https://netlify.com) → New site from Git
3. Build command: `npm run build`
4. Publish directory: `.next`
5. Add all `.env` variables in Netlify → Site settings → Environment variables
6. Set `NEXTAUTH_URL` to your Netlify domain

### Backend — FastAPI
Deploy to Railway, Render, or Fly.io:
```bash
# Example: Railway
railway init
railway up
```
Set `FASTAPI_URL` in Netlify environment variables to your deployed backend URL.

---

## Project Structure

```
├── app/                  # Next.js App Router pages + API routes
│   ├── api/              # All API routes (Prisma direct + FastAPI proxy)
│   ├── dashboard/        # Main dashboard
│   ├── groups/           # Group detail + new group
│   ├── invitations/      # Accept/decline invite via email token
│   ├── join/             # Join by invite code
│   ├── login/            # Google sign-in page
│   └── onboarding/       # Username setup after first login
├── backend/              # FastAPI backend (expenses, balances, settlements)
├── components/           # React UI components
├── lib/                  # Auth, DB, money utils, proxy helper
├── prisma/               # Schema + migrations
└── types/                # TypeScript augmentations
```

---

## Money Handling

All amounts stored as **integer paise** (1 INR = 100 paise) to avoid floating-point errors.  
`₹1,200.50` → `120050` in the database. Display layer converts back for rendering.

