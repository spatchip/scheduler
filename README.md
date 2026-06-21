# Scheduler

**Generalized Staff Booking & Scheduling Platform**

A full-featured demo application with a public booking experience for clients ("abhyasis") and a secure trainer dashboard. Includes calendar UI, timezone handling, authentication, cancellations, and simulated email notifications.

- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind, Luxon for robust UTC ↔ local timezone conversions)
- **Backend**: Express 5 + TypeScript (JWT + httpOnly cookies for auth, bcrypt for passwords)
- **Database**: PostgreSQL (with support for recurring weekly availability and full booking history)
- **Testing**: Jest + Supertest integration tests (critical paths like cancellations + email side-effects)
- **Email**: Nodemailer stub that logs beautifully formatted "emails" to the backend console (easy to enable real SMTP later)

**Live from GitHub to Production**: Fully documented below with recommended free/low-cost services (Vercel + Render + Neon Postgres).

## Key Features

### For the Public (No Login Required)
- **/book** — Responsive Public Booking Page
  - Select from seeded staff members
  - Interactive 14-day calendar (horizontal scroll, mobile-friendly, snap scrolling)
  - Real-time available hourly time slots generated from recurring weekly blocks in the DB
  - All times fetched as UTC (or interpreted as such) and **displayed in the user's browser local timezone** using Luxon
  - Create real bookings with client details (overlap protection on backend)
  - Simulated confirmation email is triggered on the server and logged in backend console

### For Trainers (Secure Login)
- **/login** — Trainer Login using credentials from the `staff` table (email + bcrypt-hashed password)
- **/dashboard** (protected) — Trainer Dashboard
  1. **Upcoming Sittings**
     - List of the trainer's own future `confirmed` bookings
     - Client name, email, service, notes + **Luxon-converted local times**
  2. **Availability Manager**
     - View current recurring weekly availability blocks (by day_of_week)
     - Add new blocks (day selector + time inputs)
     - Delete blocks — changes saved directly to PostgreSQL
- **Cancellations**: "Cancel Sitting" button on each upcoming booking
  - Confirmation prompt
  - Deletes the booking record from the database
  - Instantly refreshes the UI
  - Triggers simulated cancellation email to the client

### Shared / Admin
- Staff CRUD, raw schedule view, etc. (original features preserved)
- All critical date/time operations use Luxon for correct UTC handling and local display
- Server-side email side effects (no client trust for notifications)

## Demo Credentials (Local)

Use any of the seeded staff:

- `alice.chen@example.com` / `password123`
- `marcus.rivera@example.com` / `password123`
- `priya.patel@example.com` / `password123`

These come directly from the `staff` table (passwords are bcrypt-hashed in the DB).

## Local Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL (local or managed)
- Git

### 1. Clone & Install

```bash
git clone https://github.com/spatchip/scheduler.git
cd scheduler

# Install both sides
cd backend && npm install
cd ../frontend && npm install
```

### 2. Database (One-Time)

**Option A: Local Postgres (as originally set up)**

```bash
# Create role + DB (may need sudo -u postgres ...)
psql -U postgres -c "CREATE ROLE scheduler WITH LOGIN PASSWORD 'scheduler';"
psql -U postgres -c "CREATE DATABASE scheduler OWNER scheduler;"
psql -U postgres -d scheduler -c "GRANT ALL ON SCHEMA public TO scheduler;"

# Apply schema (includes password column for auth)
psql "postgresql://scheduler:scheduler@localhost:5432/scheduler" -f backend/sql/schema.sql
```

**Option B: Managed Postgres (Recommended even for local dev — e.g. Neon.tech)**

1. Create a free project on https://neon.tech
2. Copy the connection string
3. Run the schema against it (same `psql "your-neon-url" -f ...`)

**Seed / Verify Trainer Passwords**

The 3 demo staff already have `password123` (bcrypt-hashed) from previous setup steps. If you need to reset:

```bash
cd backend
node -e '
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const hash = await bcrypt.hash("password123", 10);
  await pool.query("UPDATE staff SET password = $1 WHERE email LIKE $2", [hash, "%@example.com"]);
  console.log("Passwords reset to password123 for demo staff");
  await pool.end();
})();
'
```

### 3. Environment Files

```bash
# Backend
cd backend
cp .env.example .env
# Edit at minimum:
#   DATABASE_URL (your local or Neon string)
#   JWT_SECRET (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" )

# Frontend
cd ../frontend
cp .env.example .env.local
# (points to backend by default)
```

### 4. Run

```bash
# Terminal 1 - Backend
cd backend
npm run dev   # http://localhost:3001

# Terminal 2 - Frontend
cd frontend
npm run dev   # http://localhost:3000
```

### 5. Explore

- Public: http://localhost:3000/book
- Trainer: http://localhost:3000/login → dashboard
- Check backend console for beautifully formatted simulated emails on booking creation and cancellation.

### Running Tests

```bash
cd backend
npm test
```

(Uses `NODE_ENV=test` so the server doesn't bind a port. Tests exercise real auth, DB, the cancellation route, and verify the email simulation is called.)

## Environment Variables Reference

| Variable              | Used By    | Example (Dev)                          | Production Notes |
|-----------------------|------------|----------------------------------------|------------------|
| `DATABASE_URL`        | Backend   | postgresql://scheduler:...@localhost:5432/scheduler | Use managed DB (Neon/Supabase). Add `?sslmode=require` or `PGSSL=true` as needed. |
| `JWT_SECRET`          | Backend   | (long random hex)                      | **Mandatory**. Generate strong value. Rotate on compromise. |
| `CORS_ORIGIN`         | Backend   | http://localhost:3000                  | Your production frontend URL (https://*.vercel.app). Update when deploying. |
| `NEXT_PUBLIC_API_URL` | Frontend  | http://localhost:3001                  | Your production backend root URL. |
| `NODE_ENV`            | Both      | development                            | production (affects cookie flags) |
| `PORT`                | Backend   | 3001                                   | Usually injected by platform (Render, etc.) |

Future email vars (when you implement real transport in `src/utils/email.ts`): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`.

## Architecture & Important Decisions

- **Separate Frontend & Backend**: Allows independent scaling and deployment (Vercel for Next.js is magical).
- **Auth**: JWT stored in httpOnly cookie (harder for XSS). Supports cross-origin production deploys via `sameSite: 'none' + secure: true`.
- **Timezones**: Every user-visible time goes through Luxon (UTC from DB → browser local). Availability blocks are stored as naive TIME + day_of_week and interpreted as UTC for slot generation.
- **Emails**: Deliberately server-side side-effects so clients can't spoof notifications. Currently 100% console simulation.
- **Cancellations**: Hard delete of the booking record (as specified). In a real system you would likely soft-delete or set `status = 'cancelled'` for audit history.
- **Testing**: Integration tests hit the real Express app + real Postgres (using seeded demo data + on-the-fly test bookings).

## From GitHub to a Live Server Environment (Production)

This project is designed to be deployable with minimal changes.

### Recommended (Free Tier Friendly) Stack
- **Postgres**: [Neon.tech](https://neon.tech) (best DX, free tier, branching)
- **Backend**: [Render.com](https://render.com) (free web service)
- **Frontend**: [Vercel](https://vercel.com) (best for Next.js)

### Step-by-Step Deployment

1. **Database**
   - Create Neon project → get pooled connection string.
   - Run `psql "your-connection-string" -f backend/sql/schema.sql`
   - Seed the three staff passwords (use the node bcrypt snippet above against the Neon URL).

2. **Backend (Render)**
   - New Web Service → connect this GitHub repo.
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `node dist/index.js`
   - **Environment Variables** (copy from `.env.example` + production values):
     - `DATABASE_URL` = your Neon string
     - `JWT_SECRET` = strong random value
     - `CORS_ORIGIN` = `https://your-frontend.vercel.app` (update after frontend deploy)
     - `NODE_ENV` = `production`

3. **Frontend (Vercel)**
   - Import repo → set Root Directory to `frontend` (or configure build accordingly).
   - Environment Variable:
     - `NEXT_PUBLIC_API_URL` = `https://your-backend.onrender.com`

4. **Final Wiring**
   - Update the Render `CORS_ORIGIN` to the actual Vercel URL and redeploy backend.
   - Test the full flow:
     - Public booking on Vercel → watch Render logs for confirmation email.
     - Login as trainer on Vercel → see your sittings + manage availability.
     - Cancel a sitting → watch for cancellation email + UI update.

### Alternative / More Production Options
- Backend on Railway, Fly.io, or your own VPS (use PM2 + nginx).
- Add a reverse proxy or deploy both behind one domain (`/api` → backend) to simplify cookies.
- Use Docker + docker-compose for consistent environments.
- For real emails: implement the transporter in `src/utils/email.ts` and add the SMTP_* vars.

**Security Checklist for Prod**
- Strong, unique `JWT_SECRET`
- `NODE_ENV=production` (enables secure cookies)
- Managed DB with SSL
- Review CORS (never `*` in prod)
- Consider adding rate limiting on `/api/auth/login`
- Never commit real secrets

## Testing

```bash
cd backend
npm test
```

The suite focuses on the cancellation + email trigger (as requested) but can be easily extended.

## Project Structure (Key Files)

```
scheduler/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # App setup, routes mounting, conditional listen for tests
│   │   ├── db.ts
│   │   ├── middleware/auth.ts       # JWT verification (cookie + Bearer)
│   │   ├── routes/
│   │   │   ├── auth.ts              # login / me / logout + cookie handling
│   │   │   ├── trainer.ts           # protected trainer endpoints (bookings, availability + cancel)
│   │   │   └── ...
│   │   ├── utils/email.ts           # Simulated (console) + ready for real nodemailer
│   │   └── __tests__/cancellation.test.ts
│   ├── sql/schema.sql
│   └── jest.config.js
├── frontend/
│   ├── app/
│   │   ├── book/page.tsx            # Public responsive booking + calendar + Luxon
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx       # Trainer protected UI (sittings + availability manager + cancel)
│   │   └── ...
│   └── ...
├── README.md                        # ← You are here (the source of truth)
└── .gitignore
```

## Recheck Notes (Performed During This Session)

- Full project re-audited start-to-end (structure, features, auth flows, time handling, DB schema, tests).
- All major features verified via builds + manual API tests + existing Jest suite.
- Cookie handling hardened for realistic cross-origin production (Vercel frontend + separate backend host).
- .env.example improved with production guidance.
- Local build artifacts cleaned.
- Multiple targeted commits for clear history and rollback capability.
- Documentation significantly expanded (this README) to cover local → production journey end-to-end.

## Next Steps / Ideas

See the "Next Steps" ideas from earlier work plus:
- Real email delivery (SendGrid, Resend, etc.)
- Soft-delete / status=‘cancelled’ for audit trail
- Better error handling & loading states in UI
- Rate limiting & input validation hardening
- Docker support
- Admin role vs trainer role differentiation

Happy scheduling — and happy deploying!

If you run into any issues getting from `git clone` to a live URL, the steps above + the code comments should get you there. Open an issue or PR with questions.