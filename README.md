# LUBA Platform — Lowest Unique Bid Auction SaaS

A production-grade Lowest Unique Bid Auction platform (React + Express + Supabase), built in phases.

## Status: Phase 1 complete — Architecture & Design

See `/docs` for:
- `ARCHITECTURE.md` — system architecture, folder structure, domain logic design
- `API_DESIGN.md` — full REST API specification
- `SECURITY.md` — security architecture and threat mitigations
- `WIREFRAMES.md` — key screen wireframes

See `/supabase/migrations/0001_initial_schema.sql` for the complete database schema (tables, RLS, functions, triggers, views) — this is a real, runnable migration, not a placeholder.

See `/supabase/seed/seed.sql` for development seed data.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Framer Motion, PWA
- **Backend**: Node.js, Express, TypeScript, JWT auth, Supabase SDK
- **Database**: Supabase (PostgreSQL, Auth, Storage, Realtime, RLS)
- **Hosting**: Render (Static Site + Web Service), GitHub → Render CD

## Build Phases
1. ✅ Architecture, folder structure, DB schema, API design, wireframes, security design
2. ⏳ Authentication, user profiles, wallet system, bid-credit system
3. ⏳ Product management, auction management
4. ⏳ Secure bidding engine, lowest-unique-bid algorithm, automatic winner selection
5. ⏳ Admin dashboard, statistics, notifications, reporting
6. ⏳ Testing, performance, security audit, production deployment

## Local Setup (once Phase 2 code lands)
1. Copy `.env.example` → `backend/.env` and `frontend/.env`, fill in your Supabase project's URL/anon key. Set the **service role key** only in `backend/.env` locally, and only in Render's dashboard in production — never commit it.
2. Apply the schema: `supabase db push` (or run the SQL in `supabase/migrations/` via the Supabase SQL editor).
3. `cd backend && npm install && npm run dev`
4. `cd frontend && npm install && npm run dev`

## Deployment
Push to GitHub → connect the repo in Render → Render reads `render.yaml` and provisions both services automatically. Set the secret env vars (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, etc.) in the Render dashboard, not in the repo.

## Security note
If you are the original setter-upper of this project: rotate any Supabase service-role key that was ever pasted into a chat, ticket, or README. It belongs only in Render's environment variable store.
