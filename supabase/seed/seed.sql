-- =====================================================================
-- LUBA Platform — Development Seed Data
-- Run AFTER 0001_initial_schema.sql, and after at least one auth user
-- exists (sign up a user first so profiles/wallets are created by the
-- fn_handle_new_user trigger), then run this to seed catalog data.
-- =====================================================================

-- Credit packs
insert into public.credit_packs (name, credits, price_cents, currency, sort_order) values
  ('Starter Pack', 10, 499, 'USD', 1),
  ('Popular Pack', 50, 1999, 'USD', 2),
  ('Pro Pack', 150, 4999, 'USD', 3),
  ('Whale Pack', 500, 14999, 'USD', 4)
on conflict do nothing;

-- Default vendor (single-vendor mode for Phase 1-5)
insert into public.vendors (id, name, is_active)
values ('00000000-0000-0000-0000-000000000001', 'LUBA Platform Store', true)
on conflict (id) do nothing;

-- Sample products
insert into public.products (id, vendor_id, title, slug, description, retail_value_cents, images, category, is_active)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Apple iPhone 15 Pro (256GB)', 'iphone-15-pro-256gb',
   'Brand new, sealed, factory unlocked.', 99900, '{}', 'Electronics', true),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Sony PlayStation 5 Slim', 'ps5-slim',
   'Latest Sony PS5 Slim console, disc edition.', 49900, '{}', 'Gaming', true),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   '$100 Amazon Gift Card', 'amazon-gift-card-100',
   'Digital gift card delivered via email.', 10000, '{}', 'Gift Cards', true)
on conflict (id) do nothing;

-- Sample auctions (adjust starts_at/ends_at as needed for testing)
insert into public.auctions
  (id, product_id, title, status, min_price_cents, max_price_cents, price_increment_cents,
   bid_cost_credits, starts_at, ends_at)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Win an iPhone 15 Pro for under $10', 'active', 1, 1000, 1,
   1, now(), now() + interval '3 days'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
   'Win a PS5 Slim for under $5', 'scheduled', 1, 500, 1,
   1, now() + interval '1 day', now() + interval '4 days')
on conflict (id) do nothing;

-- =====================================================================
-- End of seed data
-- =====================================================================
