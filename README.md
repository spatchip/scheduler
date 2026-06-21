# Scheduler

Generalized staff booking and scheduling application.

- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind)
- **Backend**: Express 5 + TypeScript
- **Database**: PostgreSQL (local)

## Project Structure

```
scheduler/
├── frontend/          # Next.js app (port 3000)
│   ├── app/
│   │   ├── page.tsx           # Dashboard
│   │   ├── staff/page.tsx     # Staff management (list + create)
│   │   ├── bookings/page.tsx  # Bookings (list + create + cancel)
│   │   ├── schedule/page.tsx  # Schedule / availability view
│   │   └── layout.tsx         # Shared header nav + layout
│   └── ...
├── backend/
│   ├── src/
│   │   ├── index.ts           # Express server + middleware
│   │   ├── db.ts              # pg Pool + helpers
│   │   └── routes/
│   │       ├── staff.ts
│   │       ├── bookings.ts
│   │       └── availability.ts
│   ├── sql/schema.sql         # Tables + indexes + optional seed
│   └── .env.example
├── README.md
└── .gitignore
```

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ running locally (service is active on this machine)

## 1. Database Setup (one-time)

Run these commands in your terminal (they require sudo on most Linux setups):

```bash
# 1. Create a dedicated non-superuser role + database
sudo -u postgres psql -c "CREATE ROLE scheduler WITH LOGIN PASSWORD 'scheduler';"
sudo -u postgres psql -c "CREATE DATABASE scheduler OWNER scheduler;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE scheduler TO scheduler;"

# 2. (Optional but recommended) Also allow the role to create tables etc in public schema
sudo -u postgres psql -d scheduler -c "GRANT ALL ON SCHEMA public TO scheduler;"
```

If your `pg_hba.conf` requires it, you may also need to ensure `host ... scram-sha-256` (or md5) lines allow connections from localhost with password. The default Ubuntu/Debian install usually does for TCP connections (`psql -h localhost`).

## 2. Apply Schema

```bash
# From project root
psql "postgresql://scheduler:scheduler@localhost:5432/scheduler" -f backend/sql/schema.sql
```

Or manually:

```bash
psql -U scheduler -d scheduler -f backend/sql/schema.sql
```

## 3. Backend

```bash
cd backend

# Copy env
cp .env.example .env
# Edit .env if your DB credentials or port differ

npm run dev
```

Backend runs on **http://localhost:3001** by default.

Health check: http://localhost:3001/api/health

## 4. Frontend

In a new terminal:

```bash
cd frontend

cp .env.example .env.local
# (Already points at localhost:3001)

npm run dev
```

Frontend runs on **http://localhost:3000**.

## 5. Usage

1. Go to http://localhost:3000
2. Use **Staff** page to add team members.
3. Use **Bookings** page to create appointments (it prevents basic overlaps).
4. Use **Schedule** page to filter by staff and see their declared availability + bookings.
5. Dashboard shows recent activity and quick status of the backend + DB.

All data is persisted in PostgreSQL.

## Initial API Routes (backend)

- `GET /api/health`
- `GET/POST /api/staff`
- `GET/PUT/DELETE /api/staff/:id`
- `GET/POST /api/bookings` (+ filters `?staffId= &status= &from= &to=`)
- `GET/PUT/DELETE /api/bookings/:id`
- `GET/POST/DELETE /api/availability`

## Next Steps / Ideas for Extension

- Add full calendar UI (FullCalendar, react-big-calendar, or Cal.com components)
- Recurring bookings + rules engine
- User auth (staff login vs admin)
- Email / SMS notifications on booking
- Conflict resolution UI + drag-and-drop rescheduling
- Services / pricing matrix per staff
- Reporting & analytics
- Multi-location support

Happy scheduling!
