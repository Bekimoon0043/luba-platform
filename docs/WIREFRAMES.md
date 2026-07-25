# LUBA Platform — UI Wireframes (Phase 1, textual)

## 1. Home / Auction Catalog
```
┌────────────────────────────────────────────────────────┐
│ Logo    Auctions  How it Works  Wallet(★120)  [Avatar] │
├────────────────────────────────────────────────────────┤
│  [ Category chips: All | Electronics | Gaming | Gift ]  │
│                                                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐            │
│  │ [img]     │  │ [img]     │  │ [img]     │            │
│  │ iPhone 15 │  │ PS5 Slim  │  │ $100 GC   │            │
│  │ Pro       │  │           │  │           │            │
│  │ 1,204 bids│  │ Starts in │  │ SETTLED   │            │
│  │ ⏱ 2d 04h  │  │ 1d 00h    │  │ Won: $0.07│            │
│  │ [Bid Now] │  │ [Notify]  │  │ [View]    │            │
│  └───────────┘  └───────────┘  └───────────┘            │
└────────────────────────────────────────────────────────┘
```

## 2. Auction Detail / Bid Placement
```
┌────────────────────────────────────────────────────────┐
│  ← Back to auctions                                     │
│  ┌───────────┐   iPhone 15 Pro (256GB)                  │
│  │           │   Retail value: $999.00                  │
│  │  [image]  │   Range: $0.01 – $10.00  (step $0.01)     │
│  │           │   Status: ACTIVE  ⏱ 2d 04h 12m remaining  │
│  └───────────┘   1,204 bids placed so far                │
│                                                          │
│  Place your bid                                          │
│  ┌──────────────────────────────┐                       │
│  │  $ [   0.00   ]  (1 credit)  │  [ Place Bid ]         │
│  └──────────────────────────────┘                       │
│  Your credit balance: ★120        [Buy more credits]     │
│                                                          │
│  Live activity                                            │
│  • A bid was just placed (2s ago)                         │
│  • A bid was just placed (11s ago)                        │
│                                                          │
│  Your bids on this auction                                │
│  $0.34 · $1.02 · $4.50                                    │
└────────────────────────────────────────────────────────┘
```
Notes: bid values of *other* users are never shown — only the live bid-count ticker (realtime) and the current user's own bids.

## 3. Wallet / Buy Credits
```
┌────────────────────────────────────────────────────────┐
│  My Wallet                          Balance: ★120        │
├────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │Starter  │ │Popular  │ │Pro      │ │Whale    │         │
│  │10 credits│ │50 credits│ │150 credits│ │500 credits│    │
│  │$4.99    │ │$19.99   │ │$49.99   │ │$149.99  │         │
│  │[Buy]    │ │[Buy]    │ │[Buy]    │ │[Buy]    │         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
│                                                          │
│  Transaction history                                      │
│  +50  Credit purchase   Jul 20                            │
│  -1   Bid on iPhone 15 Pro   Jul 21                        │
└────────────────────────────────────────────────────────┘
```

## 4. Admin Dashboard — Overview
```
┌────────────────────────────────────────────────────────┐
│  Admin › Overview                                        │
├────────────────────────────────────────────────────────┤
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐ │
│  │ Revenue   │ │ Active    │ │ Active    │ │ Bids     │ │
│  │ $12,480   │ │ Auctions:6│ │ Users:3.2k│ │ Today:840│ │
│  └───────────┘ └───────────┘ └───────────┘ └──────────┘ │
│                                                          │
│  [ Products ]  [ Auctions ]  [ Users ]  [ Reports ]      │
│                                                          │
│  Recent auctions ending soon                              │
│  iPhone 15 Pro   ends in 2h  1,204 bids  [Force close]    │
└────────────────────────────────────────────────────────┘
```

## 5. Admin — Auction Editor
```
┌────────────────────────────────────────────────────────┐
│  New Auction                                              │
│  Product: [ select existing product ▾ ]  [+ New product]  │
│  Min price: [$0.01]  Max price: [$10.00]  Step: [$0.01]   │
│  Bid cost: [1] credits                                     │
│  Rebid same slot allowed: ( ) Yes  (•) No                  │
│  Fallback if no unique bid: [ Lowest overall ▾ ]           │
│  Starts: [date/time]   Ends: [date/time]                   │
│  [ Save Draft ]   [ Publish ]                               │
└────────────────────────────────────────────────────────┘
```

## Design system notes (implemented in Phase 3+ via `frontend-design` conventions)
- Typography: a distinctive display face for auction prices/countdowns (numeric emphasis), clean sans for body.
- Color: a confident primary accent for "active auction" states, a muted neutral for "settled", clear success/danger for win/insufficient-credit states.
- Motion (Framer Motion): countdown ticks, bid-count increment micro-animation on realtime activity, credit-balance pop on purchase.
- Mobile-first, PWA installable, bottom tab nav on small screens (Auctions / Wallet / Activity / Profile).
