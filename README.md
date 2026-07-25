# LUBA Platform — Lowest Unique Bid Auction SaaS

A production-grade Lowest Unique Bid Auction platform (React + Express + Supabase), built in phases.

## Status: Phase 2–4 skeleton complete

Phase 1 design docs + schema are in place. Phase 2–4 code now includes:

- **Backend** (`backend/`): Express + TypeScript API with JWT auth middleware, wallet/profile endpoints, secure bid placement via `fn_place_bid`, auction list/detail, admin settle, and auto-settlement job.
- **Frontend** (`frontend/`): React 19 + Vite + Tailwind + TanStack Query — auction catalog, auction detail with `BidPanel`, wallet balance page.

See `/docs` for architecture, API design, security, and wireframes.

See `/supabase/migrations/0001_initial_schema.sql` for the full DB schema (RLS, `fn_place_bid`, `fn_settle_auction`).

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query
- **Backend**: Node.js, Express, TypeScript, Zod, Supabase SDK (service role)
- **Database**: Supabase (PostgreSQL, Auth, Storage, Realtime, RLS)
- **Hosting**: Render (Static Site + Web Service), GitHub → Render CD

## Build Phases
1. ✅ Architecture, folder structure, DB schema, API design, wireframes, security design
2. ✅ Authentication, user profiles, wallet system, bid-credit system (skeleton)
3. ✅ Auction listing / detail (public) + product hooks via schema
4. ✅ Secure bidding engine + lowest-unique-bid settlement job
5. ⏳ Admin dashboard, statistics, notifications, reporting
6. ⏳ Testing, performance, security audit, production deployment

## Local Setup

1. **Env files** (never commit real secrets):
   - Copy `.env.example` values into `backend/.env` and `frontend/.env` (or `.env.local`).
   - Backend needs: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`SUPABASE_SERVICE_ROLE_KEY`** (secret), `CORS_ALLOWED_ORIGINS`.
   - Frontend needs: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (e.g. `http://localhost:4000/api/v1`).

2. **Database**: Apply schema in Supabase SQL editor (or `supabase db push`), then run `supabase/seed/seed.sql` after creating at least one auth user.

3. **Run**:
   ```bash
   cd backend && npm install && npm run dev   # → http://localhost:4000
   cd frontend && npm install && npm run dev  # → http://localhost:5173
   ```

4. **Settlement job** (optional locally):
   ```bash
   cd backend && npm run job:settle
   ```
   Or POST `/api/v1/jobs/settle-auctions` (protect this in production).

## Deployment
Push to GitHub → connect the repo in Render → Render reads `render.yaml`.
**Crucial**: set `SUPABASE_SERVICE_ROLE_KEY` (and related secrets) only in the Render dashboard for the backend service — never in the repo.

## Security note
Rotate any Supabase **service role** key that was ever pasted into chat, tickets, or local notes. It belongs only in Render env vars / your local `backend/.env`.
