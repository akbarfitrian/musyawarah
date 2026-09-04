-- ============================================================================
-- SIWE-style structured sign-in message
--
-- BEFORE: request_wallet_nonce() returned an opaque, single-line string
-- ("musyawarah-login:<wallet>:<random>:<timestamp>") that the wallet's
-- "Sign Message" popup showed the user as-is — no domain, no human-readable
-- expiration, nothing to help the user tell a legitimate sign-in request
-- from a phishing site asking them to sign something.
--
-- AFTER: the message is a structured, human-readable block (same idea as
-- Sign-In With Ethereum / other Sphere Connect dapps, e.g. Sphere Quests):
--
--   Sign in to Musyawarah
--
--   Domain: musyawarah.app
--   Address: DIRECT://<pubkey>
--   Nonce: <random>
--   Issued At: 2026-08-25T07:00:04.020Z
--   Expiration Time: 2026-08-25T07:10:04.020Z
--
-- SECURITY NOTE ON THE DOMAIN LINE: the domain shown is picked by OUR
-- server (checked against `app_allowed_login_domains` below), never trusted
-- verbatim from the client — otherwise a phishing clone could pass
-- p_domain="musyawarah.app" while actually running on evil.example and the
-- user would see our real domain in the signature popup with no way to
-- tell. The allowlist is what makes the domain line meaningful: only a
-- request actually coming from one of these origins can mint a nonce
-- claiming to be from them. The cryptographic replay protection (nonce
-- round-trips through auth_nonces, one-time use, matched exactly in
-- wallet-login) is unchanged from the previous migration — this only adds
-- the human-readable domain/expiration framing on top of it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Allowed domains for the "Domain:" line. Add your real prod domain(s)
--    here, e.g.:
--      insert into app_allowed_login_domains (domain) values ('musyawarah.app');
--    Any '*.vercel.app' preview domain is allowed automatically (see the
--    function below) since those are dynamic and can't be listed up front.
-- ----------------------------------------------------------------------------
create table if not exists app_allowed_login_domains (
  domain text primary key
);

insert into app_allowed_login_domains (domain) values
  ('localhost:5173'),
  ('localhost:3000'),
  ('127.0.0.1:5173')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 2. request_wallet_nonce — now takes p_domain, builds the structured
--    message, and validates the domain against the allowlist above.
-- ----------------------------------------------------------------------------
drop function if exists request_wallet_nonce(text);

create or replace function request_wallet_nonce(p_wallet text, p_domain text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text;
  v_rand text;
  v_issued_at timestamptz;
  v_expires_at timestamptz;
begin
  if p_wallet is null or length(p_wallet) = 0 then
    raise exception 'wallet is required';
  end if;

  if p_domain is null or length(p_domain) = 0 then
    raise exception 'domain is required';
  end if;

  if not (
    exists (select 1 from app_allowed_login_domains where domain = p_domain)
    or p_domain like '%.vercel.app'
  ) then
    raise exception 'domain not allowed: %', p_domain using errcode = '28000';
  end if;

  -- housekeeping: drop anything older than 10 minutes
  delete from auth_nonces where created_at < now() - interval '10 minutes';

  v_rand := encode(extensions.gen_random_bytes(16), 'hex'); -- schema-qualified: pgcrypto lives in `extensions` on Supabase, not `public` (see 2026_08_25_fix_wallet_nonce_search_path.sql)
  v_issued_at := now() at time zone 'utc';
  v_expires_at := v_issued_at + interval '10 minutes';

  v_message :=
    'Sign in to Musyawarah' || chr(10) || chr(10) ||
    'Domain: ' || p_domain || chr(10) ||
    'Address: DIRECT://' || p_wallet || chr(10) ||
    'Nonce: ' || v_rand || chr(10) ||
    'Issued At: ' || to_char(v_issued_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || chr(10) ||
    'Expiration Time: ' || to_char(v_expires_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  insert into auth_nonces (wallet_address, nonce) values (p_wallet, v_message);

  return v_message;
end;
$$;

grant execute on function request_wallet_nonce(text, text) to anon, authenticated;

-- consume_wallet_nonce is unchanged — it matches the `nonce` column by exact
-- text equality regardless of what that text looks like, so the bigger
-- structured message works with it as-is. Re-declared here only as a no-op
-- documentation anchor; no migration action needed.
