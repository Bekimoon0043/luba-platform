# LUBA Platform — API Design (Phase 1)

Base URL: `/api/v1`
Auth: `Authorization: Bearer <supabase_jwt>` on all protected routes.
Response envelope (success): `{ "data": ... }`
Response envelope (error): `{ "error": { "code": "STRING_CODE", "message": "human readable", "details"?: {...} } }`

---

## Auth
Auth itself (sign up / sign in / password reset / OAuth) is handled **client-side by the Supabase Auth SDK** directly against Supabase — the backend does not proxy login. The backend only *verifies* the resulting JWT on protected routes.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/session` | required | Returns the caller's profile + role, derived from verified JWT |

---

## Users / Profile

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/me` | required | Get own profile |
| PATCH | `/users/me` | required | Update own profile (full_name, username, avatar_url, phone, locale) |
| GET | `/users/me/bids` | required | Paginated bid history for the current user |
| GET | `/users/me/wins` | required | Auctions won by the current user |

## Wallet / Credits

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/wallet` | required | Current credit balance |
| GET | `/wallet/transactions` | required | Paginated ledger for current user |
| GET | `/credit-packs` | public | List active purchasable credit packs |
| POST | `/wallet/purchase` | required | Initiate a credit-pack purchase (payment-gateway adapter interface; Phase 6+ concrete impl). Body: `{ creditPackId }` |
| POST | `/wallet/purchase/confirm` | required (webhook, service-to-service secret) | Payment gateway webhook confirms payment → credits credited atomically |

## Products (public catalog + admin management)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products` | public | List active products, filter by category, search, paginate |
| GET | `/products/:slug` | public | Product detail |
| POST | `/products` | admin | Create product |
| PATCH | `/products/:id` | admin | Update product |
| DELETE | `/products/:id` | admin | Soft-delete (is_active = false) |
| POST | `/products/:id/images` | admin | Upload image to Supabase Storage, attach URL |

## Auctions

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auctions` | public | List auctions (filter by status: active/scheduled/settled) |
| GET | `/auctions/:id` | public | Auction detail (sanitized — no bid values pre-settlement) |
| GET | `/auctions/:id/activity` | public | Recent sanitized activity feed (bid-count ticks) |
| POST | `/auctions` | admin | Create auction (draft) |
| PATCH | `/auctions/:id` | admin | Update auction (only while draft/scheduled) |
| POST | `/auctions/:id/publish` | admin | Move draft → scheduled/active |
| POST | `/auctions/:id/cancel` | admin | Cancel an auction (refunds all spent credits) |
| POST | `/auctions/:id/close` | admin/system | Force-close and settle immediately (also runs automatically via scheduled job at `ends_at`) |
| GET | `/auctions/:id/results` | public (only after settled) | Winner + winning bid value |
| GET | `/auctions/:id/my-bids` | required | Current user's bids on this auction (their own values only) |

## Bidding

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auctions/:id/bids` | required | Place a bid. Body: `{ bidValueCents, idempotencyKey }`. Rate-limited 1 req/sec/user/auction. Calls `fn_place_bid` server-side with service role. |

**Bid placement error codes** (mapped from Postgres function exceptions):
`AUCTION_NOT_FOUND`, `AUCTION_NOT_ACTIVE`, `AUCTION_OUTSIDE_WINDOW`, `BID_VALUE_INVALID`, `BID_SLOT_TAKEN`, `INSUFFICIENT_CREDITS`, `WALLET_NOT_FOUND`, `DUPLICATE_SUBMISSION` (idempotency key replay), `RATE_LIMITED`.

## Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications` | required | Paginated, current user |
| PATCH | `/notifications/:id/read` | required | Mark as read |
| POST | `/notifications/read-all` | required | Mark all as read |

## Admin — Users

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/users` | admin | List/search users |
| GET | `/admin/users/:id` | admin | User detail incl. wallet + bid history |
| PATCH | `/admin/users/:id/role` | admin | Change role |
| PATCH | `/admin/users/:id/status` | admin | Activate/deactivate account |
| POST | `/admin/users/:id/wallet/adjust` | admin | Manual credit adjustment (audited) |

## Admin — Reporting / Statistics

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/stats/overview` | admin | Revenue, active auctions, active users, total bids (dashboard cards) |
| GET | `/admin/stats/auctions/:id` | admin | Bid distribution, revenue for one auction |
| GET | `/admin/audit-log` | admin | Paginated audit trail |

## System

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | public | Liveness probe |
| GET | `/ready` | public | Readiness probe (checks DB connectivity) |

---

## Conventions
- **Pagination**: `?page=1&pageSize=20`, response includes `{ data, meta: { page, pageSize, total } }`.
- **Idempotency**: bid placement and wallet purchase endpoints require an `Idempotency-Key` header; backend caches the result for 24h keyed by `(user_id, key)` to make retried requests (e.g., mobile network blips) safe.
- **Validation**: every request body validated with a Zod schema before touching the DB; failures return `400` with `VALIDATION_ERROR` and field-level details.
- **Rate limiting**: global 100 req/min/IP; bid placement 1 req/sec/user/auction; auth endpoints 10 req/min/IP.
