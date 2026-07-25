# LUBA Platform — Security Architecture (Phase 1)

## 1. Trust Boundaries
- **Frontend** holds only the Supabase **anon** key. All access is mediated by RLS policies (see `0001_initial_schema.sql`).
- **Backend** holds the Supabase **service role** key, set only via Render environment variables (`SUPABASE_SERVICE_ROLE_KEY`). It is never sent to any client, never logged, never committed to git.
- **Bidding and wallet mutations** happen exclusively through `SECURITY DEFINER` Postgres functions (`fn_place_bid`, `fn_settle_auction`) invoked by the backend with the service role — regular authenticated users have **no** direct INSERT/UPDATE grant on `bids` or `wallets`, closing off client-side tampering entirely (a modified frontend request can't fabricate a bid or credit itself balance).

## 2. Authentication
- Supabase Auth issues short-lived JWTs (access token) + refresh tokens, handled by the Supabase JS SDK on the frontend (secure storage, auto-refresh).
- Backend middleware verifies the JWT signature against Supabase's JWT secret on every protected request; rejects expired/invalid tokens with `401`.
- Role (`user` / `admin` / `support`) is read from the `profiles` table server-side on each admin-route check — **never** trusted from a client-supplied header or JWT custom claim that a user could otherwise attempt to influence via metadata self-update endpoints (profile update endpoint explicitly excludes `role` from the allowed field list).

## 3. Authorization
- All admin routes protected by `requireRole('admin')` middleware, backed by the DB-level `fn_is_admin()` check as a second line of defense inside RLS — even if a backend route were misconfigured, the database itself would refuse the write.
- RLS is enabled on every single table (`ENABLE ROW LEVEL SECURITY`), default-deny; explicit policies grant only the minimum necessary access.

## 4. Bidding Integrity
- Row-level locking (`SELECT ... FOR UPDATE`) on the auction and wallet rows inside `fn_place_bid` serializes concurrent bids per auction and per user, eliminating race conditions where two simultaneous requests could double-spend a credit or both claim the same "unique" slot.
- `UNIQUE (auction_id, user_id, bid_value_cents)` constraint blocks duplicate submissions at the database level, independent of application logic.
- `Idempotency-Key` header support at the API layer protects against network-retry double submission before the request even reaches the DB function.
- Per-user-per-auction rate limiting throttles scripted/automated bidding abuse.

## 5. Input Validation
- Every request body validated with Zod on the backend (defense in depth even though the frontend also validates); rejects unexpected fields, wrong types, out-of-range values before any DB call.
- SQL is never string-concatenated; all DB access goes through the Supabase SDK's parameterized query builder or `rpc()` calls to the security-definer functions above.

## 6. Transport & Secrets
- HTTPS enforced end-to-end (Render terminates TLS for both static site and web service).
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, future payment gateway keys) live only in Render's environment variable store and `GitHub Secrets` for CI — never in the repository. `.env.example` documents required variable *names* only, with placeholder values.
- `.gitignore` excludes `.env`, `.env.local`, and any `*.key` files.

## 7. Abuse Prevention
- Global IP-based rate limiting (`express-rate-limit`) on all routes; stricter limits on `/auctions/:id/bids` and any future auth-adjacent routes.
- Helmet.js for standard HTTP security headers (CSP, HSTS, X-Frame-Options, etc.).
- CORS locked to the deployed frontend origin(s) via env-configured allowlist.
- Audit log (`audit_log` table) records every admin mutation and every wallet adjustment with before/after snapshots for forensic review.

## 8. Data Protection
- Passwords are never handled by our code — delegated entirely to Supabase Auth's hashing (bcrypt/argon2 under the hood).
- Storage buckets (`product-images`, `avatars`) scoped with their own RLS-equivalent storage policies: public read, write restricted to admins/owning user respectively.
- PII (`profiles.phone`, `profiles.full_name`) exposed only to the owning user and admins, never in public views.

## 9. Dependency & Infra Hygiene (Phase 6 detail, flagged here)
- `npm audit` / Dependabot-equivalent checks run in CI before deploy.
- Render health checks (`/health`, `/ready`) gate traffic to unhealthy instances.
- Structured logs exclude sensitive fields (tokens, full card numbers, service-role key) by default via a log-redaction allowlist.
