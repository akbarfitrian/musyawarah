-- ============================================================================
-- app_config + treasury wallet lookup
--
-- BEFORE: the escrow RPCs (lock_escrow_order, mark_order_released,
-- mark_order_refunded) hard-coded the treasury as the nametag '@masyarakat'.
-- A nametag can't be verified by the wallet-login JWT (which only carries the
-- wallet's chainPubkey), so with the auth guard on, the treasury/operator
-- checks could never match.
--
-- AFTER: the treasury is the chainPubkey (66-char lowercase hex) stored in
-- app_config under 'treasury_wallet', read through app_treasury_wallet().
-- The value can be filled in after deploy with ONE statement, e.g.:
--
--   update app_config set value = '<66-char hex chainPubkey>'
--   where key = 'treasury_wallet';
--
-- Until it is set, every escrow RPC that needs it raises a clear error
-- instead of silently comparing against the wrong wallet.
--
-- Idempotent: safe to run on a fresh DB and on one that already has it.
-- (The same block also lives in schema.sql so a fresh install gets it.)
-- ============================================================================

create table if not exists app_config (
  key text primary key,
  value text not null default ''
);

-- Nobody reads or writes this table from the client. RLS on + no policies +
-- no grants = only service_role / security-definer functions can touch it.
alter table app_config enable row level security;
revoke all on app_config from anon, authenticated;

insert into app_config (key, value) values ('treasury_wallet', '')
on conflict (key) do nothing;

create or replace function app_treasury_wallet()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_wallet text;
begin
  select value into v_wallet from app_config where key = '03cf9fd4f29e2bf37d1e7db251d7e0bbda446b5e2db0d17a2e58aefeb81ed4d60a';

  if v_wallet is null or v_wallet !~ '^[0-9a-f]{66}$' then
    raise exception
      'treasury_wallet belum dikonfigurasi di app_config (harus chainPubkey hex 66 karakter, huruf kecil)'
      using errcode = '22023';
  end if;

  return v_wallet;
end;
$$;

revoke all on function app_treasury_wallet() from public, anon, authenticated;
