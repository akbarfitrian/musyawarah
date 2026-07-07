-- MUSYAWARAH — 003: quests & achievements
-- ============================================================================
-- Jalankan file ini SETELAH schema.sql dan 002_harden_writes.sql, di Supabase
-- Dashboard -> SQL Editor. Aman dijalankan berkali-kali (idempotent).
--
-- KENAPA BUKAN "WEBHOOK"
-- -----------------------
-- App ini tidak punya backend terpisah yang menerima event dari luar --
-- semua aksi (post, follow, tip, upgrade verifikasi, edit) sudah dipanggil
-- langsung dari client lewat Postgres function SECURITY DEFINER (lihat
-- 002_harden_writes.sql). Jadi progres quest paling aman ditegakkan DI DALAM
-- function-function itu juga -- atomik sama aksi utamanya, persis pola yang
-- dipakai buat notifikasi follow/repost/tip. Bukan "webhook", tapi "trigger
-- server" yang jalan di titik yang sama dengan aksi aslinya.
--
-- Dua pengecualian yang tidak lewat function existing:
--   - "Connect Sphere Wallet": belum ada RPC buat momen connect. File ini
--     nambah function baru khusus, record_wallet_connect(), dipanggil dari
--     WalletContext.tsx tepat setelah connect() sukses.
--   - "Lengkapi Profil": upsert profil (username/avatar/bio) sengaja TIDAK
--     lewat RPC (lihat catatan di akhir 002_harden_writes.sql -- upsert
--     profil dianggap risiko rendah). Dicek pakai trigger AFTER INSERT/UPDATE
--     di tabel profiles, bukan RPC baru.
--
-- KETERBATASAN YANG SAMA DENGAN 002
-- ----------------------------------
-- Belum ada wallet-signature auth. Seseorang yang tahu alamat wallet orang
-- lain masih bisa manggil RPC ini atas nama wallet itu lewat DevTools --
-- sama persis keterbatasan yang sudah didokumentasikan di 002_harden_
-- writes.sql. Migrasi ini tidak menambah ataupun menutup celah itu.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Tabel referensi quest -- SATU-SATUNYA sumber kebenaran urutan, level,
--    poin, dan syarat unlock. Urutan & rasio (7 mudah / 2 medium / 1 sulit,
--    total 14 poin) sengaja dikunci di sini.
-- ----------------------------------------------------------------------------
create table if not exists quests (
  id text primary key,
  order_index int not null unique,
  title text not null,
  description text not null,
  level text not null check (level in ('easy', 'medium', 'hard')),
  points int not null check (points > 0),
  -- id quest lain yang harus selesai duluan sebelum quest ini "unlocked" di
  -- UI. null = quest paling awal (langsung unlocked begitu wallet connect).
  unlock_after text references quests(id),
  -- Penjelasan singkat mekanisme verifikasi, ditampilkan apa adanya di UI
  -- (kolom "Verifikasi") -- lihat catatan arsitektur di atas.
  verify_label text not null
);

insert into quests (id, order_index, title, description, level, points, unlock_after, verify_label)
values
  ('connect_wallet', 1, 'Connect Sphere Wallet', 'Connect your Sphere Wallet to Musyawarah.', 'easy', 1, null,
    'Server trigger on wallet connect (record_wallet_connect)'),
  ('complete_profile', 2, 'Complete Your Profile', 'Fill in your profile photo and bio.', 'easy', 1, 'connect_wallet',
    'Server trigger (Postgres trigger on the profiles table) once avatar_url and bio are both filled in'),
  ('first_post', 3, 'Send Your First Post', 'Send your first post.', 'easy', 1, 'complete_profile',
    'Server trigger inside create_post'),
  ('follow_3', 4, 'Follow 3 Users', 'Follow 3 other wallets.', 'easy', 1, 'first_post',
    'Server trigger inside toggle_follow (counts follows rows)'),
  ('first_tip_sent', 5, 'Send Your First Tip (UCT)', 'Send a UCT tip to someone else''s post.', 'easy', 1, 'follow_3',
    'On-chain action, recorded inside send_tip'),
  ('verified_max', 6, 'Upgrade to Verified Max', 'Upgrade your verification tier to Verified Max.', 'medium', 2, 'first_tip_sent',
    'On-chain action, recorded inside purchase_verification (tier = verified_max)'),
  ('post_with_image', 7, 'Post With an Image', 'Send a post with an image (requires a tier that allows image attachments).', 'easy', 1, 'verified_max',
    'Server trigger inside create_post when image_url is filled in'),
  ('first_edit', 8, 'Edit Your First Post', 'Edit one of your previously sent posts (requires Verified Max tier).', 'easy', 1, 'verified_max',
    'Server trigger inside edit_post'),
  ('streak_5_days', 9, 'Post 5 Days in a Row', 'Send at least 1 post per day, 5 days in a row (UTC).', 'medium', 2, 'first_post',
    'Server trigger, recalculated inside create_post (daily streak)'),
  ('receive_10_tips', 10, 'Receive 10 Tips From Others', 'Receive 10 tips (cumulative) from other wallets.', 'hard', 3, 'first_tip_sent',
    'On-chain action, counted inside send_tip (cumulative incoming tips)')
on conflict (id) do update set
  order_index = excluded.order_index,
  title = excluded.title,
  description = excluded.description,
  level = excluded.level,
  points = excluded.points,
  unlock_after = excluded.unlock_after,
  verify_label = excluded.verify_label;

-- ----------------------------------------------------------------------------
-- 1. Progres per wallet. Satu baris = satu quest yang sudah selesai buat
--    wallet itu. Idempotent lewat primary key -- "award" dua kali gak
--    dobel-catat (jadi aman dipanggil berkali-kali dari dalam function lain).
-- ----------------------------------------------------------------------------
create table if not exists user_quest_progress (
  wallet_address text not null references profiles(wallet_address) on delete cascade,
  quest_id text not null references quests(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (wallet_address, quest_id)
);

create index if not exists idx_user_quest_progress_wallet on user_quest_progress (wallet_address);

-- ----------------------------------------------------------------------------
-- 2. Helper internal -- catat quest selesai buat satu wallet. Bikin baris
--    profiles dulu kalau belum ada (jaga-jaga FK), lalu insert idempotent.
--    Dipanggil dari dalam function-function lain di file ini, BUKAN dipanggil
--    langsung dari client.
-- ----------------------------------------------------------------------------
create or replace function award_quest(p_wallet text, p_quest_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_wallet is null or length(p_wallet) = 0 then
    return;
  end if;

  insert into profiles (wallet_address) values (p_wallet) on conflict do nothing;

  insert into user_quest_progress (wallet_address, quest_id)
  values (p_wallet, p_quest_id)
  on conflict (wallet_address, quest_id) do nothing;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Connect wallet -- belum ada RPC lain yang jalan persis di momen ini,
--    jadi function baru ini yang dipanggil dari WalletContext.tsx tepat
--    setelah connect() (baik connect manual maupun silent auto-connect)
--    sukses dapat identity wallet.
-- ----------------------------------------------------------------------------
create or replace function record_wallet_connect(p_wallet text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_wallet is null or length(p_wallet) = 0 then
    raise exception 'wallet is required';
  end if;

  insert into profiles (wallet_address) values (p_wallet) on conflict do nothing;
  perform award_quest(p_wallet, 'connect_wallet');
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Lengkapi profil -- trigger di tabel profiles (bukan RPC baru), karena
--    upsert profil sendiri sudah lewat jalur .upsert() langsung dari client
--    (lihat catatan di akhir 002_harden_writes.sql). Award begitu avatar_url
--    dan bio SEMUA terisi (bukan kosong/whitespace). Username SENGAJA tidak
--    dicek di sini -- username auto-generate saat wallet dibuat, bukan
--    sesuatu yang diisi user, jadi bukan syarat quest ini.
-- ----------------------------------------------------------------------------
create or replace function trg_check_profile_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(trim(coalesce(new.avatar_url, ''))) > 0
     and length(trim(coalesce(new.bio, ''))) > 0
  then
    perform award_quest(new.wallet_address, 'complete_profile');
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_quest_check on profiles;
create trigger profiles_quest_check
  after insert or update on profiles
  for each row execute function trg_check_profile_complete();

-- ----------------------------------------------------------------------------
-- 5. create_post -- ditambah: award "first_post", award "post_with_image"
--    kalau image_url terisi, dan hitung ulang streak harian buat
--    "streak_5_days". Logic asli (kuota, batas karakter, izin gambar) TIDAK
--    diubah, cuma ditambah di akhir sebelum return.
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
  v_streak_len int;
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

  -- === quest awards, ditambahkan di 003_quests.sql ===
  perform award_quest(p_wallet, 'first_post');

  if p_image_url is not null then
    perform award_quest(p_wallet, 'post_with_image');
  end if;

  -- Streak harian (UTC): kelompokkan tanggal post distinct pakai trik
  -- "tanggal minus row_number()" -- baris yang tanggalnya berurutan bakal
  -- punya grup (d - row_number) yang sama. Ambil grup yang tanggal
  -- terakhirnya = hari ini, panjangnya = streak yang sedang berjalan.
  select count(*) into v_streak_len
  from (
    select d, d - (row_number() over (order by d))::int as grp
    from (
      select distinct (created_at at time zone 'utc')::date as d
      from posts
      where author_wallet = p_wallet
    ) distinct_days
  ) grouped
  group by grp
  having max(d) = (now() at time zone 'utc')::date
  order by count(*) desc
  limit 1;

  if coalesce(v_streak_len, 0) >= 5 then
    perform award_quest(p_wallet, 'streak_5_days');
  end if;

  return v_post;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. edit_post -- ditambah: award "first_edit" begitu edit sukses.
-- ----------------------------------------------------------------------------
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

  -- === quest award, ditambahkan di 003_quests.sql ===
  perform award_quest(p_wallet, 'first_edit');

  return v_post;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. toggle_follow -- ditambah: award "follow_3" begitu follower_wallet
--    sudah follow >= 3 wallet lain. Cuma dicek di cabang follow (bukan
--    unfollow) -- quest ini sengaja tidak dicabut kalau user unfollow lagi
--    sesudahnya (sudah pernah tercapai = tetap selesai).
-- ----------------------------------------------------------------------------
create or replace function toggle_follow(p_follower text, p_followed text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_following boolean;
  v_following_count int;
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

    -- === quest award, ditambahkan di 003_quests.sql ===
    select count(*) into v_following_count from follows where follower_wallet = p_follower;
    if v_following_count >= 3 then
      perform award_quest(p_follower, 'follow_3');
    end if;
  end if;

  return v_now_following;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. send_tip -- ditambah: award "first_tip_sent" buat pengirim, dan
--    "receive_10_tips" buat penerima begitu akumulasi tip masuknya >= 10.
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
  v_received_count int;
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

  -- === quest awards, ditambahkan di 003_quests.sql ===
  perform award_quest(p_from, 'first_tip_sent');

  select count(*) into v_received_count from tips where to_wallet = p_to;
  if v_received_count >= 10 then
    perform award_quest(p_to, 'receive_10_tips');
  end if;

  return v_tip;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. purchase_verification -- ditambah: award "verified_max" begitu tier
--    yang dibeli persis 'verified_max'.
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

  -- === quest award, ditambahkan di 003_quests.sql ===
  if p_tier = 'verified_max' then
    perform award_quest(p_wallet, 'verified_max');
  end if;

  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------
-- 10. Baca papan quest -- satu function, satu roundtrip dari client. Gabung
--     quests + progres wallet tertentu + status unlocked (unlock_after
--     null ATAU quest syaratnya sudah completed).
--     SECURITY DEFINER supaya bisa baca user_quest_progress meski tabel itu
--     sengaja tidak dikasih grant select langsung (lihat bagian 11 di bawah).
-- ----------------------------------------------------------------------------
create or replace function get_quest_board(p_wallet text)
returns table (
  quest_id text,
  title text,
  description text,
  level text,
  points int,
  order_index int,
  unlock_after text,
  unlock_after_order int,
  verify_label text,
  completed boolean,
  completed_at timestamptz,
  unlocked boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id as quest_id,
    q.title,
    q.description,
    q.level,
    q.points,
    q.order_index,
    q.unlock_after,
    uq.order_index as unlock_after_order,
    q.verify_label,
    (up.wallet_address is not null) as completed,
    up.completed_at,
    (
      q.unlock_after is null
      or exists (
        select 1 from user_quest_progress dep
        where dep.wallet_address = coalesce(p_wallet, '')
          and dep.quest_id = q.unlock_after
      )
    ) as unlocked
  from quests q
  left join quests uq on uq.id = q.unlock_after
  left join user_quest_progress up
    on up.quest_id = q.id and up.wallet_address = coalesce(p_wallet, '')
  order by q.order_index;
$$;

-- ----------------------------------------------------------------------------
-- 11. Hak akses -- quests boleh dibaca publik (referensi statis, bukan data
--     rahasia). user_quest_progress SENGAJA tidak dikasih grant select
--     langsung -- satu-satunya jalan baca progres adalah lewat
--     get_quest_board() (SECURITY DEFINER). Tulis ke dua tabel ini cuma lewat
--     award_quest() (dipanggil dari dalam function lain), tidak pernah
--     langsung dari client.
-- ----------------------------------------------------------------------------
alter table quests enable row level security;
alter table user_quest_progress enable row level security;

drop policy if exists "public read quests" on quests;
create policy "public read quests" on quests for select using (true);
-- Sengaja TIDAK ada policy select/insert/update/delete buat
-- user_quest_progress -- akses cuma lewat get_quest_board()/award_quest().

revoke insert, update, delete on quests, user_quest_progress from anon, authenticated;
revoke select on user_quest_progress from anon, authenticated;

grant select on quests to anon, authenticated;

grant execute on function award_quest(text, text) to anon, authenticated;
grant execute on function record_wallet_connect(text) to anon, authenticated;
grant execute on function get_quest_board(text) to anon, authenticated;

-- Catatan: award_quest() sengaja tetap EXECUTE-able langsung (dipakai juga
-- dari dalam function lain, dan dibuat idempotent + tanpa efek berharga
-- selain menandai satu baris quest selesai), beda kelas risiko dengan
-- send_tip/purchase_verification yang memindahkan/mencatat nilai UCT.
