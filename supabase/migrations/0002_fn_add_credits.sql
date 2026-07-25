-- =====================================================================
-- LUBA Platform — Add credits (atomic top-up) for wallet purchases
-- =====================================================================

create or replace function public.fn_add_credits(
  p_user_id uuid,
  p_credits integer,
  p_description text default 'Credit purchase',
  p_provider_ref text default null
)
returns table (
  new_balance integer,
  tx_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet record;
  v_new_balance integer;
  v_tx_id uuid;
begin
  if p_credits <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0010';
  end if;

  select * into v_wallet
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'WALLET_NOT_FOUND' using errcode = 'P0006';
  end if;

  update public.wallets
  set credit_balance = credit_balance + p_credits
  where id = v_wallet.id
  returning credit_balance into v_new_balance;

  insert into public.wallet_transactions
    (wallet_id, user_id, type, amount, balance_after, provider_ref, metadata)
  values
    (
      v_wallet.id,
      p_user_id,
      'credit_purchase',
      p_credits,
      v_new_balance,
      p_provider_ref,
      jsonb_build_object('description', p_description)
    )
  returning id into v_tx_id;

  return query select v_new_balance, v_tx_id;
end;
$$;

revoke all on function public.fn_add_credits(uuid, integer, text, text) from public;
grant execute on function public.fn_add_credits(uuid, integer, text, text) to service_role;
