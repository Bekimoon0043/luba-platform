-- =====================================================================
-- LUBA Platform — Initial Schema Migration
-- Phase 1: tables, indexes, RLS, functions, triggers, views
-- Target: Supabase PostgreSQL
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type user_role as enum ('user', 'admin', 'support');
create type auction_status as enum ('draft', 'scheduled', 'active', 'closed', 'settled', 'cancelled');
create type auction_fallback_strategy as enum ('extend', 'lowest_overall', 'no_winner');
create type wallet_tx_type as enum ('credit_purchase', 'bid_spend', 'refund', 'admin_adjustment', 'bonus');
create type notification_channel as enum ('email', 'in_app', 'telegram');
create type notification_status as enum ('pending', 'sent', 'failed');

-- ---------------------------------------------------------------------
-- profiles (extends auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  avatar_url text,
  phone text,
  role user_role not null default 'user',
  telegram_chat_id text,
  is_active boolean not null default true,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_username on public.profiles (username);
create index idx_profiles_role on public.profiles (role);

-- ---------------------------------------------------------------------
-- wallets — one per user, integer bid-credit balance
-- ---------------------------------------------------------------------
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  credit_balance integer not null default 0 check (credit_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type wallet_tx_type not null,
  amount integer not null,               -- positive = credit added, negative = credit spent
  balance_after integer not null,
  provider_ref text,                     -- external payment gateway reference (future use)
  auction_id uuid,                       -- nullable FK set below after auctions table exists
  bid_id uuid,                           -- nullable FK set below after bids table exists
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_wallet_tx_user on public.wallet_transactions (user_id, created_at desc);
create index idx_wallet_tx_wallet on public.wallet_transactions (wallet_id, created_at desc);

-- ---------------------------------------------------------------------
-- credit_packs — purchasable bid-credit bundles
-- ---------------------------------------------------------------------
create table public.credit_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credits integer not null check (credits > 0),
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'USD',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- vendors — nullable, future multi-vendor hook (single "platform" vendor used in Phase 1-5)
-- ---------------------------------------------------------------------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references public.profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id),
  title text not null,
  slug text not null unique,
  description text,
  retail_value_cents integer not null check (retail_value_cents >= 0),
  images text[] not null default '{}',
  category text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_slug on public.products (slug);
create index idx_products_category on public.products (category);
create index idx_products_title_trgm on public.products using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------
-- auctions
-- ---------------------------------------------------------------------
create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  title text not null,
  status auction_status not null default 'draft',
  min_price_cents integer not null check (min_price_cents >= 0),
  max_price_cents integer not null check (max_price_cents > min_price_cents),
  price_increment_cents integer not null check (price_increment_cents > 0),
  bid_cost_credits integer not null default 1 check (bid_cost_credits > 0),
  allow_rebid_same_slot boolean not null default false,
  fallback_strategy auction_fallback_strategy not null default 'lowest_overall',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  settled_at timestamptz,
  winner_user_id uuid references public.profiles(id),
  winning_bid_cents integer,
  total_bids integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_auction_window check (ends_at > starts_at)
);

create index idx_auctions_status on public.auctions (status);
create index idx_auctions_ends_at on public.auctions (ends_at);
create index idx_auctions_product on public.auctions (product_id);

-- ---------------------------------------------------------------------
-- bids — the hot-path table. Only ever written via fn_place_bid().
-- ---------------------------------------------------------------------
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  bid_value_cents integer not null,
  is_winning boolean not null default false,
  created_at timestamptz not null default now(),
  constraint uq_bid_no_duplicate unique (auction_id, user_id, bid_value_cents)
);

create index idx_bids_auction_value on public.bids (auction_id, bid_value_cents);
create index idx_bids_user on public.bids (user_id, created_at desc);
create index idx_bids_auction_user on public.bids (auction_id, user_id);

alter table public.wallet_transactions
  add constraint fk_wallet_tx_auction foreign key (auction_id) references public.auctions(id),
  add constraint fk_wallet_tx_bid foreign key (bid_id) references public.bids(id);

-- ---------------------------------------------------------------------
-- auction_activity — sanitized realtime feed (no bid values, just ticks)
-- ---------------------------------------------------------------------
create table public.auction_activity (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  event_type text not null,               -- 'bid_placed' | 'auction_extended' | 'auction_closed'
  total_bids integer not null,
  created_at timestamptz not null default now()
);

create index idx_auction_activity_auction on public.auction_activity (auction_id, created_at desc);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel notification_channel not null,
  title text not null,
  body text not null,
  status notification_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications (user_id, created_at desc);
create index idx_notifications_status on public.notifications (status);

-- ---------------------------------------------------------------------
-- user_events — lightweight behavioral log (future AI recommendations)
-- ---------------------------------------------------------------------
create table public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,               -- 'view_product' | 'view_auction' | 'place_bid' ...
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_user_events_user on public.user_events (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- audit_log — financial / admin action trail
-- ---------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_log_entity on public.audit_log (entity_type, entity_id);

-- =====================================================================
-- TRIGGERS: updated_at maintenance
-- =====================================================================
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.fn_touch_updated_at();
create trigger trg_wallets_touch before update on public.wallets
  for each row execute function public.fn_touch_updated_at();
create trigger trg_products_touch before update on public.products
  for each row execute function public.fn_touch_updated_at();
create trigger trg_auctions_touch before update on public.auctions
  for each row execute function public.fn_touch_updated_at();

-- Auto-create profile + wallet on new auth.users row
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username');

  insert into public.wallets (user_id, credit_balance)
  values (new.id, 0);

  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- =====================================================================
-- CORE FUNCTION: fn_place_bid — atomic, race-safe bid placement
-- =====================================================================
create or replace function public.fn_place_bid(
  p_auction_id uuid,
  p_user_id uuid,
  p_bid_value_cents integer
)
returns table (
  bid_id uuid,
  new_balance integer,
  total_bids integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction record;
  v_wallet record;
  v_existing_count integer;
  v_bid_id uuid;
  v_new_total integer;
begin
  -- Lock the auction row to serialize all bid placements for this auction
  select * into v_auction
  from public.auctions
  where id = p_auction_id
  for update;

  if not found then
    raise exception 'AUCTION_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_auction.status <> 'active' then
    raise exception 'AUCTION_NOT_ACTIVE' using errcode = 'P0002';
  end if;

  if now() < v_auction.starts_at or now() >= v_auction.ends_at then
    raise exception 'AUCTION_OUTSIDE_WINDOW' using errcode = 'P0003';
  end if;

  if p_bid_value_cents < v_auction.min_price_cents
     or p_bid_value_cents > v_auction.max_price_cents
     or ((p_bid_value_cents - v_auction.min_price_cents) % v_auction.price_increment_cents) <> 0 then
    raise exception 'BID_VALUE_INVALID' using errcode = 'P0004';
  end if;

  if not v_auction.allow_rebid_same_slot then
    select count(*) into v_existing_count
    from public.bids
    where auction_id = p_auction_id and bid_value_cents = p_bid_value_cents;

    if v_existing_count > 0 then
      raise exception 'BID_SLOT_TAKEN' using errcode = 'P0005';
    end if;
  end if;

  -- Lock the wallet row to serialize balance mutations for this user
  select * into v_wallet
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'WALLET_NOT_FOUND' using errcode = 'P0006';
  end if;

  if v_wallet.credit_balance < v_auction.bid_cost_credits then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0007';
  end if;

  -- Deduct credits
  update public.wallets
  set credit_balance = credit_balance - v_auction.bid_cost_credits
  where id = v_wallet.id
  returning credit_balance into v_new_total;

  -- Insert the bid (unique constraint gives duplicate-submission protection too)
  insert into public.bids (auction_id, user_id, bid_value_cents)
  values (p_auction_id, p_user_id, p_bid_value_cents)
  returning id into v_bid_id;

  -- Ledger entry
  insert into public.wallet_transactions
    (wallet_id, user_id, type, amount, balance_after, auction_id, bid_id)
  values
    (v_wallet.id, p_user_id, 'bid_spend', -v_auction.bid_cost_credits, v_new_total, p_auction_id, v_bid_id);

  -- Bump auction bid counter
  update public.auctions
  set total_bids = total_bids + 1
  where id = p_auction_id
  returning total_bids into v_new_total;

  -- Sanitized realtime activity tick (no bid value exposed)
  insert into public.auction_activity (auction_id, event_type, total_bids)
  values (p_auction_id, 'bid_placed', v_new_total);

  return query select v_bid_id, (select credit_balance from public.wallets where id = v_wallet.id), v_new_total;
end;
$$;

revoke all on function public.fn_place_bid(uuid, uuid, integer) from public;
grant execute on function public.fn_place_bid(uuid, uuid, integer) to service_role;

-- =====================================================================
-- CORE FUNCTION: fn_settle_auction — lowest-unique-bid winner selection
-- =====================================================================
create or replace function public.fn_settle_auction(p_auction_id uuid)
returns table (
  winner_user_id uuid,
  winning_bid_cents integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction record;
  v_winner record;
begin
  select * into v_auction
  from public.auctions
  where id = p_auction_id
  for update;

  if not found then
    raise exception 'AUCTION_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_auction.status = 'settled' then
    return query select v_auction.winner_user_id, v_auction.winning_bid_cents;
    return;
  end if;

  -- Lowest bid value with exactly one bidder
  select b.user_id, b.bid_value_cents into v_winner
  from public.bids b
  where b.auction_id = p_auction_id
  group by b.bid_value_cents, b.user_id
  having count(*) filter (where true) = (
    select count(*) from public.bids b2
    where b2.auction_id = p_auction_id and b2.bid_value_cents = b.bid_value_cents
  ) and (
    select count(*) from public.bids b3
    where b3.auction_id = p_auction_id and b3.bid_value_cents = b.bid_value_cents
  ) = 1
  order by b.bid_value_cents asc
  limit 1;

  if v_winner is null then
    if v_auction.fallback_strategy = 'lowest_overall' then
      select b.user_id, b.bid_value_cents into v_winner
      from public.bids b
      where b.auction_id = p_auction_id
      order by b.bid_value_cents asc, b.created_at asc
      limit 1;
    end if;
    -- 'no_winner' -> v_winner stays null; 'extend' handled by application layer (jobs/auctionClose.ts)
  end if;

  update public.auctions
  set status = 'settled',
      settled_at = now(),
      winner_user_id = v_winner.user_id,
      winning_bid_cents = v_winner.bid_value_cents
  where id = p_auction_id;

  if v_winner.user_id is not null then
    update public.bids
    set is_winning = true
    where auction_id = p_auction_id
      and user_id = v_winner.user_id
      and bid_value_cents = v_winner.bid_value_cents;
  end if;

  insert into public.auction_activity (auction_id, event_type, total_bids)
  values (p_auction_id, 'auction_closed', v_auction.total_bids);

  return query select v_winner.user_id, v_winner.bid_value_cents;
end;
$$;

revoke all on function public.fn_settle_auction(uuid) from public;
grant execute on function public.fn_settle_auction(uuid) to service_role;

-- =====================================================================
-- VIEWS
-- =====================================================================

-- Public-safe auction listing: never exposes individual bid values pre-settlement
create or replace view public.v_auction_public as
select
  a.id,
  a.product_id,
  a.title,
  a.status,
  a.min_price_cents,
  a.max_price_cents,
  a.price_increment_cents,
  a.bid_cost_credits,
  a.starts_at,
  a.ends_at,
  a.total_bids,
  case when a.status = 'settled' then a.winning_bid_cents else null end as winning_bid_cents,
  case when a.status = 'settled' then a.winner_user_id else null end as winner_user_id,
  p.title as product_title,
  p.images as product_images,
  p.retail_value_cents
from public.auctions a
join public.products p on p.id = a.product_id;

-- Per-user "my bids" view (only the requesting user's own rows are visible via RLS on base table)
create or replace view public.v_my_bids as
select
  b.id,
  b.auction_id,
  b.user_id,
  b.bid_value_cents,
  b.is_winning,
  b.created_at,
  a.title as auction_title,
  a.status as auction_status
from public.bids b
join public.auctions a on a.id = b.auction_id;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.credit_packs enable row level security;
alter table public.vendors enable row level security;
alter table public.products enable row level security;
alter table public.auctions enable row level security;
alter table public.bids enable row level security;
alter table public.auction_activity enable row level security;
alter table public.notifications enable row level security;
alter table public.user_events enable row level security;
alter table public.audit_log enable row level security;

-- Helper: is the current user an admin?
create or replace function public.fn_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.fn_is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_admin_all" on public.profiles
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- wallets — read-only to owner; all writes happen via SECURITY DEFINER functions (service role)
create policy "wallets_select_own_or_admin" on public.wallets
  for select using (user_id = auth.uid() or public.fn_is_admin());
create policy "wallets_admin_write" on public.wallets
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- wallet_transactions — read-only to owner
create policy "wallet_tx_select_own_or_admin" on public.wallet_transactions
  for select using (user_id = auth.uid() or public.fn_is_admin());
create policy "wallet_tx_admin_write" on public.wallet_transactions
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- credit_packs — public read of active packs, admin write
create policy "credit_packs_public_read" on public.credit_packs
  for select using (is_active = true or public.fn_is_admin());
create policy "credit_packs_admin_write" on public.credit_packs
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- vendors
create policy "vendors_public_read" on public.vendors
  for select using (is_active = true or public.fn_is_admin());
create policy "vendors_admin_write" on public.vendors
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- products — public read of active products, admin write
create policy "products_public_read" on public.products
  for select using (is_active = true or public.fn_is_admin());
create policy "products_admin_write" on public.products
  for insert with check (public.fn_is_admin());
create policy "products_admin_update" on public.products
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());
create policy "products_admin_delete" on public.products
  for delete using (public.fn_is_admin());

-- auctions — public read (base table; sensitive fields hidden via v_auction_public in app layer), admin write
create policy "auctions_public_read" on public.auctions
  for select using (status <> 'draft' or public.fn_is_admin());
create policy "auctions_admin_write" on public.auctions
  for insert with check (public.fn_is_admin());
create policy "auctions_admin_update" on public.auctions
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());
create policy "auctions_admin_delete" on public.auctions
  for delete using (public.fn_is_admin());

-- bids — users can see ONLY their own bids; nobody can INSERT directly (must go through fn_place_bid)
create policy "bids_select_own_or_admin" on public.bids
  for select using (user_id = auth.uid() or public.fn_is_admin());
create policy "bids_admin_all" on public.bids
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());
-- Note: no insert/update/delete policy for regular users -> RLS default-denies direct writes.
-- fn_place_bid/fn_settle_auction run as SECURITY DEFINER and bypass RLS by design.

-- auction_activity — public read (sanitized, no bid values)
create policy "auction_activity_public_read" on public.auction_activity
  for select using (true);
create policy "auction_activity_admin_write" on public.auction_activity
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- notifications — owner read/update (mark read), admin all
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid() or public.fn_is_admin());
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_admin_write" on public.notifications
  for insert with check (public.fn_is_admin());

-- user_events — insert own, admin read all
create policy "user_events_insert_own" on public.user_events
  for insert with check (user_id = auth.uid() or user_id is null);
create policy "user_events_select_admin" on public.user_events
  for select using (public.fn_is_admin());

-- audit_log — admin only
create policy "audit_log_admin_only" on public.audit_log
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- =====================================================================
-- REALTIME
-- =====================================================================
alter publication supabase_realtime add table public.auction_activity;
alter publication supabase_realtime add table public.auctions;

-- =====================================================================
-- End of migration 0001
-- =====================================================================
