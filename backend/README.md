# Scheduler Backend

Express + TypeScript API for the Scheduler booking platform.

## Local Development

```bash
npm run dev
```

Server runs on port 3001 by default.

## Key Endpoints

### Public
- `GET /api/health`
- `GET/POST/PUT/DELETE /api/staff`
- `GET/POST/PUT/DELETE /api/bookings`
- `GET/POST/DELETE /api/availability`

### Authentication
- `POST /api/auth/login` — email + password (from `staff` table)
- `GET /api/auth/me` — current user (requires valid session)
- `POST /api/auth/logout`

### Trainer (Protected — JWT via cookie or Authorization header)
- `GET /api/trainer/bookings` — trainer's upcoming confirmed sittings
- `GET /api/trainer/availability`
- `POST /api/trainer/availability`
- `DELETE /api/trainer/availability/:id`
- `DELETE /api/trainer/bookings/:id` — cancel (delete) a booking + triggers simulated email

## Environment Variables

See root `.env.example` (and the main project README).

Important ones:
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`

## Authentication

Uses JWT signed with `JWT_SECRET`. Token is returned in an `httpOnly` cookie named `auth_token`.

Protected routes use the `authenticateToken` middleware (supports cookie and `Authorization: Bearer`).

## Email Notifications

All "emails" are currently simulated via console logging in `src/utils/email.ts`. The functions `sendBookingConfirmation` and `sendBookingCancellation` are called from:

- Booking creation (`src/routes/bookings.ts`)
- Trainer cancellation (`src/routes/trainer.ts`)

To enable real emails, replace the body of `sendEmail(...)` with a real `nodemailer` transporter.

## Testing

```bash
npm test
```

See the root README and `src/__tests__/cancellation.test.ts` for the integration test covering the protected cancellation flow + email trigger.

## Production Notes

- Set `NODE_ENV=production`
- Use a strong `JWT_SECRET`
- Configure proper `CORS_ORIGIN`
- Cookie settings automatically switch to `sameSite: 'none'; secure: true` in production (see `src/routes/auth.ts`)
- Use a managed Postgres with SSL

## Building for Production

```bash
npm run build
npm start
```
