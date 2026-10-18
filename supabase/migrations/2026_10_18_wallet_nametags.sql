-- ============================================================================
-- Unicity ID (@nametag) sebagai username + fix treasury lookup
-- ============================================================================
-- Jalankan sekali di Supabase SQL Editor. Idempotent.
--
-- Konteks:
--   Login JWT memakai chainPubkey (66 hex) sebagai identitas kriptografis, itu
--   tetap dan memang harus begitu. Tapi wallet Unicity membayar ke Unicity ID
--   (@nametag) / alamat DIRECT yang diturunkan dari key, BUKAN ke pubkey mentah
--   yang dibungkus "DIRECT://". Jadi kita simpan nametag tiap wallet di tabel
--   terpisah dan dipakai buat (a) tampilan username, (b) petunjuk tujuan
--   pembayaran (selalu diverifikasi ulang ke wallet lewat sphere_resolve
--   sebelum uang dikirim, lihat resolvePayableRecipient di WalletContext).
--
--   Kenapa BUKAN profiles.username: policy tabel profiles di schema.sql
--   ("public update own profile" using (true)) mengizinkan siapa pun menimpa
--   baris siapa pun. wallet_nametags dikunci: client hanya boleh SELECT, tulis
--   cuma lewat set_my_nametag() yang mengecek JWT (assert_wallet_owner).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. FIX BUG: app_treasury_wallet() mencari key = '<pubkey hex>' alih-alih
--    key = 'treasury_wallet'. Akibatnya fungsi ini SELALU raise "belum
--    dikonfigurasi" walaupun app_config sudah diisi, dan semua RPC escrow yang
--    memanggilnya ikut gagal. (Sepertinya kena find/replace nilai pubkey.)
-- ---------------------------------------------------------------------------
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
  select value into v_wallet from app_config where key = 'treasury_wallet';

  if v_wallet is null or v_wallet !~ '^[0-9a-f]{66}$' then
    raise exception
      'treasury_wallet belum dikonfigurasi di app_config (harus chainPubkey hex 66 karakter, huruf kecil)'
      using errcode = '22023';
  end if;

  return v_wallet;
end;
$$;

revoke all on function app_treasury_wallet() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. wallet_nametags: wallet_address (chainPubkey) -> nametag (tanpa "@")
-- ---------------------------------------------------------------------------
create table if not exists wallet_nametags (
  wallet_address text primary key,
  nametag        text not null,
  updated_at     timestamptz not null default now(),
  constraint wallet_nametags_wallet_check  check (wallet_address ~ '^0[23][0-9a-f]{64}$'),
  constraint wallet_nametags_nametag_check check (nametag ~ '^[a-z0-9_-]{3,20}$')
);

-- Satu nametag cuma boleh dipegang satu wallet di app ini.
create unique index if not exists wallet_nametags_nametag_key on wallet_nametags (nametag);

alter table wallet_nametags enable row level security;

drop policy if exists "public read wallet_nametags" on wallet_nametags;
create policy "public read wallet_nametags" on wallet_nametags for select using (true);

-- Tidak ada policy insert/update/delete + grant ditarik: hanya fungsi
-- security definer di bawah yang bisa menulis.
revoke all on wallet_nametags from anon, authenticated;
grant select on wallet_nametags to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. set_my_nametag(p_wallet, p_nametag)
--    Dipanggil client tiap selesai login (identity.nametag dari wallet).
--    p_nametag kosong/null = hapus (user belum / tidak punya Unicity ID).
--    Return: nametag yang tersimpan (tanpa "@") atau null.
-- ---------------------------------------------------------------------------
create or replace function set_my_nametag(p_wallet text, p_nametag text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag text;
begin
  perform assert_wallet_owner(p_wallet);

  v_tag := lower(btrim(regexp_replace(coalesce(p_nametag, ''), '^@', '')));

  if v_tag = '' then
    delete from wallet_nametags where wallet_address = p_wallet;
    return null;
  end if;

  if v_tag !~ '^[a-z0-9_-]{3,20}$' then
    raise exception 'invalid_nametag' using errcode = '22023';
  end if;

  if exists (
    select 1 from wallet_nametags
    where nametag = v_tag and wallet_address <> p_wallet
  ) then
    raise exception 'nametag_taken' using errcode = '23505';
  end if;

  insert into wallet_nametags (wallet_address, nametag)
  values (p_wallet, v_tag)
  on conflict (wallet_address)
  do update set nametag = excluded.nametag, updated_at = now();

  return v_tag;
end;
$$;

revoke all on function set_my_nametag(text, text) from public, anon;
grant execute on function set_my_nametag(text, text) to authenticated;
