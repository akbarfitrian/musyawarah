-- MUSYAWARAH — 002: harden writes against direct/fake row inserts
-- ============================================================================
-- Jalankan file ini SETELAH schema.sql, di Supabase Dashboard -> SQL Editor.
-- Aman dijalankan berkali-kali (idempotent).
--
-- MASALAH YANG DIPERBAIKI
-- ------------------------
-- Sebelumnya, SEMUA aturan (kuota posting harian, batas karakter per tier,
-- harga verifikasi, "gak bisa tip diri sendiri", dst) cuma ditegakkan di
-- client (React). RLS di schema.sql sengaja longgar ("public read/write").
-- Artinya siapa aja yang tau URL + anon key Supabase (keduanya ADA di bundle
-- JS yang dikirim ke browser) bisa langsung POST ke REST API Supabase dan:
--   - insert row `posts` tanpa peduli kuota harian / batas karakter tier
--   - insert row `tips` palsu (tx_hash asal-asalan) buat pura-pura di-tip
--   - insert row `follows`/`reposts` massal buat farming angka follower/repost
--   - insert row `verifications` buat ngasih diri sendiri badge/tier PADAHAL
--     nggak pernah bayar
-- Ini juga persis vektor yang dipakai buat "farming poin" kalau sistem
-- poin/quest dihitung dari tabel-tabel ini.
--
-- PERBAIKAN DI FILE INI
-- ---------------------
-- 1. Semua aturan bisnis (kuota, batas karakter, cek harga, cek kepemilikan,
--    "gak bisa follow/tip/repost diri sendiri", tx_hash gak boleh dipakai
--    dua kali) dipindahin ke Postgres function SECURITY DEFINER.
-- 2. Hak INSERT/UPDATE/DELETE langsung ke tabel `posts`, `tips`, `follows`,
--    `reposts`, `verifications`, `notifications` DICABUT dari role `anon`/
--    `authenticated`. Baca (SELECT) tetap boleh (feed publik).
-- 3. Client (React) WAJIB manggil function ini lewat supabase.rpc(...),
--    bukan .insert()/.update()/.delete() langsung -- lihat perubahan di
--    src/hooks & src/components yang menyertai migrasi ini.
--
-- KETERBATASAN YANG MASIH ADA (baca ini!)
-- ----------------------------------------
-- App ini belum punya sistem auth (identity = wallet address yang cuma
-- "dipercaya" dari client, gak ada tanda tangan/signature yang dicek server).
-- Migrasi ini menutup celah "insert row mentah lewat REST API" dan menegakkan
-- SEMUA aturan bisnis di server, TAPI belum membuktikan "yang manggil
-- function ini beneran pemilik wallet X" -- seseorang masih bisa manggil
-- rpc('send_tip', { p_from: 'wallet_orang_lain', ... }) lewat DevTools kalau
-- mereka tau alamat wallet orang itu. Buat nutup ini sepenuhnya, langkah
-- selanjutnya adalah wallet-auth beneran: server ngasih challenge/nonce,
-- wallet nandatangan pesan itu (kalau Sphere Connect protocol udah nyediain
-- intent buat sign message), lalu server verifikasi signature-nya sebelum
-- ngasih token akses. Itu di luar cakupan migrasi ini karena butuh detail
-- algoritma signature Sphere/Unicity yang belum ada di codebase ini.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Tabel konfigurasi tier -- SATU-SATUNYA sumber kebenaran di sisi SERVER
--    buat kuota/batas karakter/harga. HARUS SELALU DISINKRONKAN MANUAL kalau
--    TIER_CONFIG di src/lib/verification.ts diubah -- keduanya sengaja
--    dipisah (client buat UI cepat, server buat validasi beneran) supaya
--    perubahan besar (misal nambah tier baru) gak lolos diam-diam kalau
--    salah satu lupa diupdate.
-- ----------------------------------------------------------------------------
create table if not exists tier_config (
  tier text primary key check (tier in ('none', 'verified', 'verified_pro', 'verified_max')),
  daily_post_limit int,              -- null = tanpa batas
  max_post_chars int not null,
  can_attach_image boolean not null,
  can_edit_post boolean not null,
  monthly_price_uct numeric not null,
  annual_discount numeric not null default 0.15
);

insert into tier_config (tier, daily_post_limit, max_post_chars, can_attach_image, can_edit_post, monthly_price_uct)
values
  ('none', 1, 100, false, false, 0),
  ('verified', 3, 300, false, false, 30),
  ('verified_pro', 5, 500, true, false, 50),
  ('verified_max', 10, 1000, true, true, 100)
on conflict (tier) do update set
  daily_post_limit = excluded.daily_post_limit,
  max_post_chars = excluded.max_post_chars,
  can_attach_image = excluded.can_attach_image,
  can_edit_post = excluded.can_edit_post,
  monthly_price_uct = excluded.monthly_price_uct,
  annual_discount = excluded.annual_discount;

-- Cegah tx_hash yang sama dicatat lebih dari sekali (replay) -- ini yang
-- nutup celah "insert row tips/verifications palsu berkali-kali".
create unique index if not exists idx_tips_tx_hash_unique on tips (tx_hash) where tx_hash is not null;
create unique index if not exists idx_verifications_tx_hash_unique on verifications (tx_hash) where tx_hash is not null;

-- ----------------------------------------------------------------------------
-- 1. Helper: tier aktif wallet tertentu (null/expired dianggap 'none')
-- ----------------------------------------------------------------------------
create or replace function active_tier(p_wallet text)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select case when v.expires_at is not null and v.expires_at <= now() then 'none' else v.tier end
      from verifications v
      where v.wallet_address = p_wallet
    ),
    'none'
  )
$$;

-- ----------------------------------------------------------------------------
-- 2. Posts: create / edit / delete -- kuota harian, batas karakter, izin
--    gambar/edit semua dicek DI SINI (server), bukan cuma di client lagi.
-- ----------------------------------------------------------------------------
create or replace function create_post(p_wallet text, p_content text, p_image_url text default null)
returns posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_cfg tier_config%rowtype;
  v_used int;
  v_content text := trim(coalesce(p_content, ''));
  v_post posts;
begin
  if p_wallet is null or length(p_wallet) = 0 then
    raise exception 'wallet is required';
  end if;

  if v_content = '' and p_image_url is null then
    raise exception 'post cannot be empty';
  end if;

  v_tier := active_tier(p_wallet);
  select * into v_cfg from tier_config where tier = v_tier;

  if length(v_content) > v_cfg.max_post_chars then
    raise exception 'content exceeds % character limit for tier %', v_cfg.max_post_chars, v_tier;
  end if;

  if p_image_url is not null and not v_cfg.can_attach_image then
    raise exception 'tier % cannot attach images', v_tier;
  end if;

  if v_cfg.daily_post_limit is not null then
    select count(*) into v_used
    from posts
    where author_wallet = p_wallet
      and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';

    if v_used >= v_cfg.daily_post_limit then
      raise exception 'daily post quota (%) reached for tier %', v_cfg.daily_post_limit, v_tier;
    end if;
  end if;

  insert into profiles (wallet_address) values (p_wallet)
  on conflict (wallet_address) do nothing;

  insert into posts (author_wallet, content, image_url)
  values (p_wallet, v_content, p_image_url)
  returning * into v_post;

  return v_post;
end;
$$;

create or replace function edit_post(p_wallet text, p_post_id uuid, p_content text)
returns posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_cfg tier_config%rowtype;
  v_content text := trim(coalesce(p_content, ''));
  v_post posts;
begin
  v_tier := active_tier(p_wallet);
  select * into v_cfg from tier_config where tier = v_tier;

  if not v_cfg.can_edit_post then
    raise exception 'tier % cannot edit posts', v_tier;
  end if;

  if v_content = '' then
    raise exception 'content cannot be empty';
  end if;

  if length(v_content) > v_cfg.max_post_chars then
    raise exception 'content exceeds % character limit for tier %', v_cfg.max_post_chars, v_tier;
  end if;

  update posts
  set content = v_content, edited_at = now()
  where id = p_post_id and author_wallet = p_wallet
  returning * into v_post;

  if v_post.id is null then
    raise exception 'post not found or not owned by this wallet';
  end if;

  return v_post;
end;
$$;

create or replace function delete_post(p_wallet text, p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from posts where id = p_post_id and author_wallet = p_wallet;
  if not found then
    raise exception 'post not found or not owned by this wallet';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Follow toggle -- gak bisa follow diri sendiri, notifikasi ikut
--    dibikin/dihapus ATOMIK di function yang sama (gak ada celah "follow
--    kejadian tapi notif nggak", atau sebaliknya).
-- ----------------------------------------------------------------------------
create or replace function toggle_follow(p_follower text, p_followed text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_following boolean;
begin
  if p_follower is null or p_followed is null or length(p_follower) = 0 or length(p_followed) = 0 then
    raise exception 'both wallets are required';
  end if;
  if p_follower = p_followed then
    raise exception 'cannot follow yourself';
  end if;

  if exists (select 1 from follows where follower_wallet = p_follower and followed_wallet = p_followed) then
    delete from follows where follower_wallet = p_follower and followed_wallet = p_followed;
    delete from notifications
      where recipient_wallet = p_followed and actor_wallet = p_follower and type = 'follow';
    v_now_following := false;
  else
    insert into profiles (wallet_address) values (p_follower) on conflict do nothing;
    insert into follows (follower_wallet, followed_wallet) values (p_follower, p_followed);
    insert into notifications (recipient_wallet, actor_wallet, type)
      values (p_followed, p_follower, 'follow');
    v_now_following := true;
  end if;

  return v_now_following;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Repost toggle -- gak bisa repost post sendiri, post harus beneran ada.
-- ----------------------------------------------------------------------------
create or replace function toggle_repost(p_wallet text, p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author text;
  v_now_reposted boolean;
begin
  select author_wallet into v_author from posts where id = p_post_id;
  if v_author is null then
    raise exception 'post not found';
  end if;
  if v_author = p_wallet then
    raise exception 'cannot repost your own post';
  end if;

  if exists (select 1 from reposts where post_id = p_post_id and wallet_address = p_wallet) then
    delete from reposts where post_id = p_post_id and wallet_address = p_wallet;
    delete from notifications
      where actor_wallet = p_wallet and post_id = p_post_id and type = 'repost';
    v_now_reposted := false;
  else
    insert into reposts (post_id, wallet_address) values (p_post_id, p_wallet);
    insert into notifications (recipient_wallet, actor_wallet, type, post_id)
      values (v_author, p_wallet, 'repost', p_post_id);
    v_now_reposted := true;
  end if;

  return v_now_reposted;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Tip -- gak bisa tip diri sendiri, to_wallet HARUS penulis post-nya,
--    amount > 0, dan tx_hash gak boleh dipakai dua kali (lihat unique index
--    di atas) biar satu transfer UCT beneran cuma bisa dicatat SEKALI.
-- ----------------------------------------------------------------------------
create or replace function send_tip(
  p_from text, p_to text, p_post_id uuid, p_amount numeric, p_tx_hash text default null
)
returns tips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_author text;
  v_tip tips;
begin
  if p_from is null or p_to is null then
    raise exception 'wallets are required';
  end if;
  if p_from = p_to then
    raise exception 'cannot tip your own post';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be greater than 0';
  end if;

  select author_wallet into v_post_author from posts where id = p_post_id;
  if v_post_author is null then
    raise exception 'post not found';
  end if;
  if v_post_author <> p_to then
    raise exception 'to_wallet does not match the post author';
  end if;

  insert into tips (post_id, from_wallet, to_wallet, amount, tx_hash)
  values (p_post_id, p_from, p_to, p_amount, p_tx_hash)
  returning * into v_tip;

  insert into notifications (recipient_wallet, actor_wallet, type, post_id, amount)
  values (p_to, p_from, 'tip', p_post_id, p_amount);

  return v_tip;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Purchase verification -- harga DIHITUNG ULANG di server dari
--    tier_config (bukan dipercaya mentah-mentah dari client), jadi client
--    gak bisa kirim p_amount asal2an buat dapet tier mahal murah.
-- ----------------------------------------------------------------------------
create or replace function purchase_verification(
  p_wallet text, p_tier text, p_billing text, p_amount numeric, p_tx_hash text default null
)
returns verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg tier_config%rowtype;
  v_expected numeric;
  v_expires timestamptz;
  v_row verifications;
begin
  if p_tier not in ('verified', 'verified_pro', 'verified_max') then
    raise exception 'invalid tier: %', p_tier;
  end if;
  if p_billing not in ('monthly', 'yearly') then
    raise exception 'invalid billing interval: %', p_billing;
  end if;

  select * into v_cfg from tier_config where tier = p_tier;

  v_expected := case
    when p_billing = 'yearly' then round(v_cfg.monthly_price_uct * 12 * (1 - v_cfg.annual_discount))
    else v_cfg.monthly_price_uct
  end;

  if p_amount is distinct from v_expected then
    raise exception 'amount % does not match expected price % for tier % (%)',
      p_amount, v_expected, p_tier, p_billing;
  end if;

  v_expires := case
    when p_billing = 'yearly' then now() + interval '1 year'
    else now() + interval '1 month'
  end;

  insert into profiles (wallet_address) values (p_wallet) on conflict do nothing;

  insert into verifications (wallet_address, tier, amount_paid, billing_interval, expires_at, tx_hash, updated_at)
  values (p_wallet, p_tier, p_amount, p_billing, v_expires, p_tx_hash, now())
  on conflict (wallet_address) do update set
    tier = excluded.tier,
    amount_paid = excluded.amount_paid,
    billing_interval = excluded.billing_interval,
    expires_at = excluded.expires_at,
    tx_hash = excluded.tx_hash,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Cabut hak tulis langsung, sisain hak baca (feed tetap publik) + kasih
--    hak EXECUTE ke function-function di atas. Ini bagian yang BENERAN
--    nutup celah "insert row lewat REST API mentah".
-- ----------------------------------------------------------------------------
revoke insert, update, delete on posts, tips, reposts, follows, verifications, notifications
  from anon, authenticated;

grant select on posts, tips, reposts, follows, verifications, notifications
  to anon, authenticated;

grant execute on function active_tier(text) to anon, authenticated;
grant execute on function create_post(text, text, text) to anon, authenticated;
grant execute on function edit_post(text, uuid, text) to anon, authenticated;
grant execute on function delete_post(text, uuid) to anon, authenticated;
grant execute on function toggle_follow(text, text) to anon, authenticated;
grant execute on function toggle_repost(text, uuid) to anon, authenticated;
grant execute on function send_tip(text, text, uuid, numeric, text) to anon, authenticated;
grant execute on function purchase_verification(text, text, text, numeric, text) to anon, authenticated;

-- Catatan: `profiles` sengaja TIDAK dicabut hak tulisnya -- upsert bio/avatar
-- gak ngubah poin/uang, jadi risikonya beda kelas sama tabel-tabel di atas.
