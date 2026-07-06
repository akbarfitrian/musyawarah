-- MUSYAWARAH — schema v0 ("ala kadarnya")
-- Jalankan file ini di Supabase Dashboard -> SQL Editor -> New query -> Run

create extension if not exists "pgcrypto"; -- buat gen_random_uuid()

-- 1. Profiles (identity = wallet address, tidak perlu sistem login terpisah)
create table if not exists profiles (
  wallet_address text primary key,
  username text,
  avatar_url text,
  bio text check (char_length(bio) <= 160),
  created_at timestamptz not null default now()
);

-- 2. Posts / cast
-- NOTE: batas 1000 karakter di sini adalah batas ATAS global (tier tertinggi,
-- Verified Max). Batas per-tier yang lebih ketat (Free 100 / Verified 300 /
-- Verified Pro 500) ditegakkan di sisi klien -- lihat src/lib/verification.ts.
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_wallet text not null references profiles(wallet_address) on delete cascade,
  content text not null check (char_length(content) <= 1000),
  image_url text, -- cuma keisi buat tier yang boleh nyisipin gambar (Verified Pro & Max)
  edited_at timestamptz, -- keisi kalau post ini pernah diedit (cuma tier Verified Max yang boleh edit)
  created_at timestamptz not null default now()
);

-- Kalau tabel `posts` udah ada dari sebelum kolom-kolom ini ditambahin,
-- migrasi aman buat dijalanin ulang (idempotent):
alter table posts add column if not exists image_url text;
alter table posts add column if not exists edited_at timestamptz;
alter table posts drop constraint if exists posts_content_check;
alter table posts add constraint posts_content_check check (char_length(content) <= 1000);

-- 3. Tips
create table if not exists tips (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  from_wallet text not null,
  to_wallet text not null,
  amount numeric not null check (amount > 0),
  tx_hash text, -- diisi kalau sudah pakai transfer on-chain beneran
  created_at timestamptz not null default now()
);

-- 4. Reposts ("boost" — nge-share ulang post orang lain ke feed sendiri,
-- kayak retweet. Satu wallet cuma bisa repost sekali per post; klik lagi
-- buat undo (row-nya dihapus) — logikanya ada di RepostButton.tsx.
create table if not exists reposts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  wallet_address text not null,
  created_at timestamptz not null default now(),
  unique (post_id, wallet_address)
);

create index if not exists idx_posts_created_at on posts (created_at desc);
create index if not exists idx_tips_post_id on tips (post_id);
create index if not exists idx_reposts_post_id on reposts (post_id);
create index if not exists idx_reposts_wallet on reposts (wallet_address);

-- 5. Direct messages (DM 1-on-1 antar wallet, kayak Twitter DM tapi paling
-- sederhana — nggak ada grup, nggak ada request/accept, langsung kirim).
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_wallet text not null,
  receiver_wallet text not null,
  content text not null check (char_length(content) <= 1000),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_sender on messages (sender_wallet, created_at desc);
create index if not exists idx_messages_receiver on messages (receiver_wallet, created_at desc);

-- 6. Follows (kayak follow di Twitter/X — satu arah, wallet A follow wallet B
-- nggak berarti B follow balik A). `follower_wallet` = yang nge-follow,
-- `followed_wallet` = yang di-follow. Satu wallet cuma bisa follow wallet
-- yang sama sekali; klik lagi buat unfollow (row-nya dihapus) — logikanya
-- ada di FollowButton.tsx.
create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  follower_wallet text not null,
  followed_wallet text not null,
  created_at timestamptz not null default now(),
  unique (follower_wallet, followed_wallet),
  check (follower_wallet <> followed_wallet)
);

create index if not exists idx_follows_follower on follows (follower_wallet);
create index if not exists idx_follows_followed on follows (followed_wallet);

-- 7. Verifications ("centang biru/emas/berlian") -- status verifikasi wallet,
-- dibeli pakai UCT (dikirim ke wallet treasury platform lewat sendTip() yang
-- sama dipakai buat tip biasa, lihat WalletContext.tsx & useVerification.ts).
-- Satu wallet cuma punya SATU baris (upsert): beli tier baru = ganti tier
-- lama, bukan numpuk. Wallet yang nggak ada baris di sini = tier "none"
-- (free), nggak perlu disimpan eksplisit.
--
--   tier            | UCT/bulan | UCT/tahun (hemat 15%) | badge         | post/hari | max karakter | gambar | edit
--   ----------------|-----------|-----------------------|---------------|-----------|--------------|--------|------
--   (none / free)   | -         | -                     | -             | 1         | 100          | tidak  | tidak
--   verified        | 30        | 306                   | centang biru  | 3         | 300          | tidak  | tidak
--   verified_pro    | 50        | 510                   | centang emas  | 5         | 500          | ya     | tidak
--   verified_max    | 100       | 1.020                 | centang indigo| 10        | 1.000        | ya     | ya
--
-- Harga & kuota di atas cuma dokumentasi -- sumber kebenarannya ada di
-- TIER_CONFIG (src/lib/verification.ts), dan itu yang dipakai di sisi klien.
create table if not exists verifications (
  wallet_address text primary key references profiles(wallet_address) on delete cascade,
  tier text not null check (tier in ('verified', 'verified_pro', 'verified_max')),
  amount_paid numeric not null default 0,
  -- Billing: bulanan atau tahunan (tahunan dapet diskon 15%, lihat
  -- ANNUAL_DISCOUNT di src/lib/verification.ts). expires_at dipakai buat
  -- nentuin kapan langganan ini kadaluarsa (dicek di sisi klien tiap load,
  -- lihat useVerification.ts -- kalau lewat, tier dianggap balik ke 'none').
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly')),
  expires_at timestamptz,
  tx_hash text, -- diisi kalau sudah pakai transfer on-chain beneran (hasil sendTip)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migrasi aman buat tabel yang udah ada dari sebelum kolom billing ditambahin:
alter table verifications add column if not exists billing_interval text not null default 'monthly';
alter table verifications add column if not exists expires_at timestamptz;
alter table verifications drop constraint if exists verifications_billing_interval_check;
alter table verifications add constraint verifications_billing_interval_check
  check (billing_interval in ('monthly', 'yearly'));

create index if not exists idx_verifications_tier on verifications (tier);
create index if not exists idx_verifications_expires_at on verifications (expires_at);

alter table verifications enable row level security;

drop policy if exists "public read verifications" on verifications;
create policy "public read verifications" on verifications for select using (true);
drop policy if exists "public upsert verifications" on verifications;
create policy "public upsert verifications" on verifications for insert with check (true);
-- Longgar juga ("ala kadarnya") -- proteksi "cuma wallet itu sendiri yang bisa
-- upgrade/ganti tier-nya" ditegakkan di sisi klien (useVerification.ts nge-
-- upsert pakai .eq('wallet_address', walletAddress) dari wallet yang lagi
-- connect, SETELAH sendTip() ke treasury sukses), BUKAN di kebijakan RLS ini.
-- Sebelum production, ganti jadi cek wallet signature asli + verifikasi
-- tx_hash beneran di chain (jangan cuma percaya klien bilang "udah bayar").
drop policy if exists "public update verifications" on verifications;
create policy "public update verifications" on verifications for update using (true);

-- === RLS ===
-- NOTE: ini kebijakan LONGGAR (siapa aja boleh baca & tulis) khusus buat tahap
-- "ala kadarnya". Sebelum production, ganti jadi cek wallet signature asli.
alter table profiles enable row level security;
alter table posts enable row level security;
alter table tips enable row level security;

drop policy if exists "public read profiles" on profiles;
create policy "public read profiles" on profiles for select using (true);
drop policy if exists "public upsert profiles" on profiles;
create policy "public upsert profiles" on profiles for insert with check (true);
drop policy if exists "public update own profile" on profiles;
create policy "public update own profile" on profiles for update using (true);

drop policy if exists "public read posts" on posts;
create policy "public read posts" on posts for select using (true);
drop policy if exists "public insert posts" on posts;
create policy "public insert posts" on posts for insert with check (true);
-- Longgar juga ("ala kadarnya") — proteksi "cuma penulis yang bisa hapus"
-- ditegakkan di sisi klien (PostCard.tsx nge-filter tombol delete + query
-- .eq('author_wallet', walletAddress)), BUKAN di kebijakan RLS ini. Sebelum
-- production, ganti jadi cek wallet signature asli biar nggak bisa dilewatin
-- lewat request langsung ke Supabase.
drop policy if exists "public delete posts" on posts;
create policy "public delete posts" on posts for delete using (true);
-- Longgar juga ("ala kadarnya") — dipakai buat fitur edit post (cuma tier
-- Verified Max, lihat canEditPost() di lib/verification.ts). Proteksi "cuma
-- penulis yang bisa edit" ditegakkan di sisi klien (PostCard.tsx nge-query
-- .eq('author_wallet', walletAddress)), BUKAN di kebijakan RLS ini. Sebelum
-- production, ganti jadi cek wallet signature asli.
drop policy if exists "public update posts" on posts;
create policy "public update posts" on posts for update using (true);

drop policy if exists "public read tips" on tips;
create policy "public read tips" on tips for select using (true);
drop policy if exists "public insert tips" on tips;
create policy "public insert tips" on tips for insert with check (true);

alter table reposts enable row level security;

drop policy if exists "public read reposts" on reposts;
create policy "public read reposts" on reposts for select using (true);
drop policy if exists "public insert reposts" on reposts;
create policy "public insert reposts" on reposts for insert with check (true);
-- Longgar juga ("ala kadarnya") — proteksi "cuma yang punya repost yang bisa
-- undo" ditegakkan di sisi klien (RepostButton.tsx nge-filter
-- .eq('wallet_address', walletAddress)), BUKAN di kebijakan RLS ini. Sebelum
-- production, ganti jadi cek wallet signature asli.
drop policy if exists "public delete reposts" on reposts;
create policy "public delete reposts" on reposts for delete using (true);

alter table messages enable row level security;

-- Longgar juga ("ala kadarnya") — proteksi "cuma pengirim/penerima yang
-- boleh baca percakapan itu" ditegakkan di sisi klien (useMessages.ts nge-
-- filter .or(sender_wallet.eq / receiver_wallet.eq)), BUKAN di kebijakan RLS
-- ini. Sebelum production, ganti jadi cek wallet signature asli.
drop policy if exists "public read messages" on messages;
create policy "public read messages" on messages for select using (true);
drop policy if exists "public insert messages" on messages;
create policy "public insert messages" on messages for insert with check (true);
drop policy if exists "public update messages" on messages;
create policy "public update messages" on messages for update using (true);

alter table follows enable row level security;

drop policy if exists "public read follows" on follows;
create policy "public read follows" on follows for select using (true);
drop policy if exists "public insert follows" on follows;
create policy "public insert follows" on follows for insert with check (true);
-- Longgar juga ("ala kadarnya") — proteksi "cuma yang follow yang bisa
-- unfollow" ditegakkan di sisi klien (FollowButton.tsx nge-filter
-- .eq('follower_wallet', walletAddress)), BUKAN di kebijakan RLS ini. Sebelum
-- production, ganti jadi cek wallet signature asli.
drop policy if exists "public delete follows" on follows;
create policy "public delete follows" on follows for delete using (true);

-- 8. Notifications ("ada yg follow", "ada yg repost", "ada yg tip" -- lonceng
-- di Sidebar/mobile nav). Satu baris = satu kejadian yang perlu diberitahu ke
-- `recipient_wallet`, dipicu oleh `actor_wallet`. Dibikin best-effort di sisi
-- klien PERSIS di titik yang sama tempat follow/repost/tip beneran terjadi
-- (lihat src/lib/notify.ts, dipanggil dari useFollow.ts, RepostButton.tsx,
-- TipButton.tsx) -- BUKAN lewat trigger SQL, biar konsisten sama gaya "query
-- langsung dari klien" yang dipakai di seluruh app ini.
--
-- Requirement penting: kalau follow/repost di-UNDO (unfollow / un-repost),
-- notifikasinya harus IKUT HILANG, bukan cuma ditandain "read". Makanya
-- notifyFollow/notifyRepost (insert) SELALU dipasangin sama
-- removeFollowNotification/removeRepostNotification (delete) di titik toggle
-- yang sama -- lihat lib/notify.ts. Tip nggak punya lawannya (nggak ada
-- "untip"), jadi notifikasi tip nggak pernah dihapus otomatis.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_wallet text not null,
  actor_wallet text not null,
  type text not null check (type in ('follow', 'repost', 'tip')),
  -- keisi buat repost & tip (post yang direpost / ditip), null buat follow.
  post_id uuid references posts(id) on delete cascade,
  -- keisi cuma buat tip (jumlah UCT yang dikirim). null buat follow/repost.
  amount numeric,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (type = 'follow' and post_id is null and amount is null)
    or (type = 'repost' and post_id is not null and amount is null)
    or (type = 'tip' and post_id is not null and amount is not null)
  )
);

create index if not exists idx_notifications_recipient on notifications (recipient_wallet, created_at desc);
-- Dipakai buat nyari-cepat notif follow/repost yang harus dihapus pas
-- unfollow/un-repost (lihat lib/notify.ts).
create index if not exists idx_notifications_actor_lookup on notifications (recipient_wallet, actor_wallet, type, post_id);

alter table notifications enable row level security;

-- Longgar juga kayak tabel lain di app ini ("ala kadarnya") -- proteksi "cuma
-- recipient yang boleh nandain notifnya sendiri udah dibaca / cuma actor yang
-- efektif bikin notif atas nama dia sendiri" ditegakkan di sisi klien
-- (useNotifications.ts & lib/notify.ts nge-filter pakai wallet yang lagi
-- connect), BUKAN di kebijakan RLS ini. Sebelum production, ganti jadi cek
-- wallet signature asli.
drop policy if exists "public read notifications" on notifications;
create policy "public read notifications" on notifications for select using (true);
drop policy if exists "public insert notifications" on notifications;
create policy "public insert notifications" on notifications for insert with check (true);
drop policy if exists "public update notifications" on notifications;
create policy "public update notifications" on notifications for update using (true);
drop policy if exists "public delete notifications" on notifications;
create policy "public delete notifications" on notifications for delete using (true);

-- === MIGRASI (kalau tabel `profiles` udah ada duluan sebelum kolom bio) ===
-- Aman dijalanin berkali-kali (IF NOT EXISTS).
alter table profiles add column if not exists bio text;
alter table profiles drop constraint if exists profiles_bio_check;
alter table profiles add constraint profiles_bio_check check (char_length(bio) <= 160);

-- === STORAGE — foto profil ===
-- Bucket public buat nyimpen foto profil. Validasi ukuran file (max ~2MB,
-- lihat MAX_AVATAR_BYTES di src/lib/avatarUpload.ts) & tipe file dilakukan
-- di sisi klien sebelum upload — "ala kadarnya" buat tahap awal, belum ada
-- validasi ulang di server/Storage policy.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Longgar juga kayak RLS tabel di atas — siapa aja boleh baca & upload.
-- Sebelum production, ganti jadi cek wallet signature asli.
drop policy if exists "public read avatars" on storage.objects;
create policy "public read avatars" on storage.objects
  for select using (bucket_id = 'avatars');
drop policy if exists "public upload avatars" on storage.objects;
create policy "public upload avatars" on storage.objects
  for insert with check (bucket_id = 'avatars');
drop policy if exists "public update avatars" on storage.objects;
create policy "public update avatars" on storage.objects
  for update using (bucket_id = 'avatars');
drop policy if exists "public delete avatars" on storage.objects;
create policy "public delete avatars" on storage.objects
  for delete using (bucket_id = 'avatars');
