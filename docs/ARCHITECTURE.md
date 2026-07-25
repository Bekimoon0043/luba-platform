# LUBA Platform — System Architecture (Phase 1)

**Product**: Lowest Unique Bid Auction (LUBA) SaaS Platform
**Model**: Users purchase bid credits, place bids (each bid costs one credit) on a product at a price point. When the auction closes, the **lowest bid value that was submitted by exactly one user** wins the product at that price.

---

## 1. High-Level Architecture

```
┌──────────────────────────┐        ┌───────────────────────────┐        ┌─────────────────────────┐
│   Frontend (React SPA)   │  HTTPS │   Backend (Express API)    │  HTTPS │   Supabase (PostgreSQL)  │
│   Render Static Site     │◄──────►│   Render Web Service        │◄──────►│   Auth / DB / Storage /  │
│   Vite + TS + Tailwind   │        │   Node + TS + JWT           │        │   Realtime / RLS         │
└──────────────────────────┘        └───────────────┬─────────────┘        └─────────────┬────────────┘
        ▲                                            │                                     │
        │  Realtime (Supabase channels, direct)      │  Service-role calls (bidding, admin)│
        └────────────────────────────────────────────┴─────────────────────────────────────┘
```

**Key architectural decision**: the frontend talks to Supabase **directly** (via anon key + RLS) for read-heavy, low-risk operations (browsing auctions, viewing own profile, realtime bid-count updates). It talks to the **Express backend** for anything security- or business-logic-critical: placing a bid, wallet/credit transactions, auction settlement, admin actions. This keeps the trust boundary clear:

- **Anon key (frontend)** → constrained entirely by RLS. Can never see other users' bid values, wallet balances, or place a bid directly against the `bids` table.
- **Service role key (backend only, env var on Render)** → used exclusively inside backend services for operations that must bypass RLS under controlled, audited business logic (e.g., atomic bid placement, credit deduction, winner computation). Never shipped to any client bundle.

---

## 2. Component Responsibilities

### 2.1 Frontend (React 19 + TS + Vite)
- Public auction catalog, auction detail pages, countdown timers
- Auth (Supabase Auth via SDK: email/password, magic link, OAuth-ready)
- Wallet dashboard, bid-credit purchase flow (payment gateway stubbed as an extension point for Phase 6+)
- Bid placement UI with optimistic UI + realtime bid-count/last-bid feed (Supabase Realtime channel, read-only)
- User bid history, win history
- Admin dashboard (role-gated route tree)
- PWA: installable, offline shell, push-notification ready

### 2.2 Backend (Express + TS)
- REST API, versioned under `/api/v1`
- JWT verification middleware (verifies Supabase-issued JWT on every protected route)
- **Bidding engine** — the only writer of the `bids` table. Enforces atomicity via Postgres advisory locks + `SELECT ... FOR UPDATE` inside a DB function (see §4.3) to prevent race conditions and duplicate submissions.
- Wallet/credit ledger — the only writer of `wallet_transactions` / credit balance mutations.
- Auction lifecycle management (create/publish/close/settle)
- Winner computation job (triggered on auction close, idempotent)
- Notification dispatch (email/in-app; Telegram bot is a pluggable notification channel — see §7)
- Admin-only endpoints (product/auction CRUD, user management, reporting)
- Structured logging (Pino) + request correlation IDs
- Rate limiting (per-IP and per-user) on bid placement and auth endpoints

### 2.3 Database (Supabase PostgreSQL)
- All tables owned by Postgres, RLS enabled on every table by default
- Database functions (`plpgsql`) for atomic bid placement and winner selection — business rules live close to the data to guarantee consistency regardless of which client calls them
- Triggers for `updated_at` maintenance, wallet balance denormalization, audit logging
- Views for public-safe auction stats (bid count, current lowest unique bid **status only**, never leaking bid values pre-close)
- Realtime enabled on `auctions` and a sanitized `auction_activity` table (bid *count* ticks, not bid values) so the frontend can show "a bid was just placed" without leaking competitive information

### 2.4 Storage (Supabase Storage)
- `product-images` bucket (public read, admin write) for product photography
- `avatars` bucket (public read, owner write)

---

## 3. Folder Structure

```
luba-platform/
├── frontend/
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   ├── src/
│   │   ├── app/                 # App shell, router, providers
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── ui/              # Reusable primitives (Button, Card, Modal, Input...)
│   │   │   ├── auction/         # AuctionCard, CountdownTimer, BidFeed
│   │   │   ├── wallet/          # WalletBalance, CreditPackCard
│   │   │   └── layout/          # Navbar, Footer, Sidebar
│   │   ├── features/
│   │   │   ├── auth/            # login, register, forgot-password
│   │   │   ├── auctions/        # catalog, detail, bid-placement
│   │   │   ├── wallet/          # credit purchase, transaction history
│   │   │   ├── profile/         # user profile, win history
│   │   │   └── admin/           # admin dashboard modules
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   ├── supabaseClient.ts
│   │   │   ├── apiClient.ts     # axios/fetch wrapper for backend REST calls
│   │   │   └── queryClient.ts   # TanStack Query config
│   │   ├── schemas/             # Zod schemas shared with forms
│   │   ├── stores/              # lightweight client state (auth session, UI)
│   │   ├── types/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/               # env loading, supabase admin client, logger
│   │   ├── middleware/           # auth, rateLimit, errorHandler, validate
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── wallet/
│   │   │   ├── products/
│   │   │   ├── auctions/
│   │   │   ├── bids/             # the bidding engine
│   │   │   ├── admin/
│   │   │   └── notifications/
│   │   ├── jobs/                 # auction-close cron, winner settlement
│   │   ├── routes/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── tsconfig.json
│   └── package.json
│
├── supabase/
│   ├── migrations/                # numbered SQL migrations (source of truth for schema)
│   └── seed/                      # seed.sql for demo data
│
├── docs/
│   ├── ARCHITECTURE.md            # this file
│   ├── API_DESIGN.md
│   ├── SECURITY.md
│   ├── DATABASE_SCHEMA.md
│   ├── WIREFRAMES.md
│   └── DEPLOYMENT.md              # added in Phase 6
│
├── render.yaml
├── .gitignore
├── .env.example
└── README.md
```

---

## 4. Core Domain Logic (design, implemented in Phase 4)

### 4.1 Bid Credit Model
- Users buy **credit packs** (e.g., 10 credits = $X). Credits are stored as an integer balance in `wallets`.
- Placing a bid costs exactly **1 credit**, deducted atomically with bid insertion.
- No credit refunds on losing bids (standard LUBA model) — configurable per-tenant flag for future multi-vendor use.

### 4.2 Lowest Unique Bid Algorithm
- Each auction has a fixed **bid increment** and a **price range** (e.g., $0.01 to $10.00 in $0.01 steps) — each price "slot" can be bid on by any number of users, but each *bid placement* by a user claims one slot at one moment; a user can rebid a different (or the same, if allowed) slot, each costing a credit.
- On auction close: the winner is the **lowest price slot that has exactly one bid** across the auction's lifetime. If no unique bid exists, configurable fallback (extend auction / lowest bid overall / no winner) — this is an admin-configurable `auction.fallback_strategy`.
- This computation is done by a **database function** (`fn_settle_auction`) using a single set-based SQL query (`GROUP BY bid_value HAVING COUNT(*) = 1 ORDER BY bid_value ASC LIMIT 1`), guaranteeing correctness under concurrent load since it runs once, post-close, inside a transaction with the auction row locked.

### 4.3 Race Condition & Duplicate Bid Prevention
- Bid placement is wrapped in `fn_place_bid(auction_id, user_id, bid_value)`, a `SECURITY DEFINER` Postgres function that:
  1. Takes a row lock on the auction (`SELECT ... FOR UPDATE`) to serialize bids per auction.
  2. Validates auction is still open (`now() < ends_at` and `status = 'active'`).
  3. Validates bid_value is within range/increment and (if configured) not already taken depending on auction mode.
  4. Locks the user's wallet row (`SELECT ... FOR UPDATE`) and checks/deducts 1 credit.
  5. Inserts the bid row.
  6. All inside a single transaction — if any step fails, everything rolls back, credit is never lost.
- A **unique constraint** on `(auction_id, user_id, bid_value)` prevents identical duplicate submissions (e.g., accidental double-click/network retry) at the DB level as a second line of defense on top of frontend debouncing + backend idempotency keys.
- Backend additionally rate-limits bid submissions per user per auction (e.g., max 1 request/second) to blunt scripted bidding abuse.

---

## 5. Cross-Cutting Concerns
- **Error handling**: centralized Express error middleware, typed `AppError` class, consistent JSON error shape `{ error: { code, message, details? } }`.
- **Logging**: Pino structured logs, request-id correlation, separate audit log table for financial/wallet events.
- **Validation**: Zod schemas on both frontend (forms) and backend (request bodies) — single source of truth types generated from Zod.
- **Auth**: Supabase Auth issues JWT; backend verifies JWT signature via Supabase JWT secret / JWKS; role (`user`/`admin`) carried in `app_metadata`, never trusted from client input.
- **Extensibility hooks** (built in from Phase 1, not bolted on later):
  - `notifications` module is channel-agnostic (`email`, `in_app`, and a `telegram` channel stub interface for later)
  - `payments` module interface is defined but the concrete gateway adapter is deferred
  - Multi-vendor: `vendor_id` nullable FK present on `products` from day one so "single vendor now, multi-vendor later" requires no schema migration, only RLS/UI changes
  - i18n: frontend strings routed through a single `t()` abstraction from the start (react-i18next-ready), even though only English ships in Phase 1

---

## 6. Non-Functional Requirements
- **Concurrency target**: thousands of simultaneous users; bidding hot path isolated to a single DB function call per bid (minimizes round trips), connection pooling via Supabase's PgBouncer (transaction mode) from the backend.
- **Availability**: stateless backend (horizontally scalable on Render), all state in Postgres — safe to run multiple backend instances.
- **Observability**: `/health` and `/ready` endpoints for Render health checks; structured logs shippable to any log drain.

---

## 7. Extension Points (explicitly designed for, not built yet)
| Future Feature | Hook already in place |
|---|---|
| Telegram Bot | `notifications` channel interface + `users.telegram_chat_id` nullable column |
| Mobile App | Backend is a pure REST API, no server-rendered coupling |
| Payment Gateway | `payments` module interface, `wallet_transactions.provider_ref` column |
| AI Recommendations | `user_events` table capturing views/bids for future feature pipeline |
| Multi-vendor | `vendor_id` FK on `products`, RLS designed per-vendor-ready |
| Additional Languages | i18n abstraction in frontend from day one |

---

*End of Phase 1 architecture document.*
