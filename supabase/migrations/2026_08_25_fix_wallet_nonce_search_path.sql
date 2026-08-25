-- ============================================================================
-- Fix: request_wallet_nonce() fails with
--   "function gen_random_bytes(integer) does not exist"
--
-- CAUSE: the function is `security definer` with `set search_path = public`.
-- On Supabase, pgcrypto is installed into the `extensions` schema, not
-- `public`, so gen_random_bytes() is invisible under that locked-down
-- search_path even though the extension itself exists.
--
-- FIX: schema-qualify the call explicitly (safer than just widening
-- search_path, since this is a security definer function).
-- ============================================================================

create or replace function request_wallet_nonce(p_wallet text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nonce text;
begin
  if p_wallet is null or length(p_wallet) = 0 then
    raise exception 'wallet is required';
  end if;

  -- housekeeping: drop anything older than 10 minutes
  delete from auth_nonces where created_at < now() - interval '10 minutes';

  v_nonce := 'musyawarah-login:' || p_wallet || ':'
    || encode(extensions.gen_random_bytes(16), 'hex') || ':'
    || extract(epoch from now())::bigint;

  insert into auth_nonces (wallet_address, nonce) values (p_wallet, v_nonce);

  return v_nonce;
end;
$$;

grant execute on function request_wallet_nonce(text) to anon, authenticated;
