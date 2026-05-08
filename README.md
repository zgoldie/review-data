# App Store Review Times

Public dashboard and webhook-backed metrics for App Store review timing.

## Runtime architecture

- Frontend: Vite + React
- API: Vercel Functions under `api/`
- Database: Supabase Postgres

## Deploy on Vercel + Supabase

1. Connect this repo to Vercel.
2. Install/attach Supabase via Vercel Marketplace integration.
3. In Supabase SQL editor, run `supabase/schema.sql`.
4. Deploy.

## Required environment variables

The Vercel + Supabase integration normally injects these:

- `POSTGRES_URL` (preferred)
- `POSTGRES_PRISMA_URL` (fallback)
- `POSTGRES_URL_NON_POOLING` (fallback)

Optional:

- `SUPABASE_URL` - used for auth token verification in API routes
- `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` - used to verify bearer tokens via Supabase Auth
- `VITE_API_BASE_URL` - only needed if frontend should call an external API host instead of same-origin `/api`.

## API routes

- `GET /api/health`
- `GET /api/metrics/overview?rangeDays=30`
- `GET /api/metrics/trends?months=9`
- `POST /api/webhooks/apple`
- `GET /api/my-app/setup` (auth required)
- `POST /api/my-app/secret` (auth required)
- `POST /api/my-app/secret/rotate` (auth required)

## Basic auth + webhook secret flow

1. User signs in with Supabase email/password and receives a bearer token.
2. Client calls `POST /api/my-app/secret` with `Authorization: Bearer <token>`.
3. API returns a one-time secret value (store it securely).
4. User configures App Store Connect webhook with the provided per-user URL + secret.
5. `POST /api/webhooks/apple?hook=...` resolves user by hook token and verifies `x-apple-signature` using that user secret.
6. Matching webhook events are attributed to that user and ingested.

Use `POST /api/my-app/secret/rotate` to invalidate the previous secret and issue a new one.

## Local scripts

- `npm run dev` - Vite frontend + legacy local Express API
- `npm run build` - frontend production build
- `npm run lint` - lint project files

## Notes

- `api/` routes are the Vercel production path.
- Existing `server/` code remains for local prototype workflows and seeded demo data.
- Public dashboard metrics remain global in this pass; user-specific metrics can be layered on top later.
