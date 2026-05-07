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

- `WEBHOOK_SECRET_MAP` - comma-separated secret to user mapping:
  - Example: `secret_a:user_1,secret_b:user_2`
- `VITE_API_BASE_URL` - only needed if frontend should call an external API host instead of same-origin `/api`.

## API routes

- `GET /api/health`
- `GET /api/metrics/overview?rangeDays=30`
- `GET /api/metrics/trends?months=9`
- `POST /api/webhooks/apple`

## Local scripts

- `npm run dev` - Vite frontend + legacy local Express API
- `npm run build` - frontend production build
- `npm run lint` - lint project files

## Notes

- `api/` routes are the Vercel production path.
- Existing `server/` code remains for local prototype workflows and seeded demo data.
