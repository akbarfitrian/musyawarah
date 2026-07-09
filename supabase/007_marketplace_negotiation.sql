-- MUSYAWARAH — 007: marketplace Fase 2 (nego & tawar-menawar di DM)
-- ============================================================================
-- Jalankan file ini SETELAH schema.sql, 002_harden_writes.sql, 003_quests.sql,
-- 004_top_tipped.sql, 005_top_tipped_posts.sql, dan 006_marketplace_listings.sql,
-- di Supabase Dashboard -> SQL Editor. Aman dijalankan berkali-kali (idempotent).
--
-- Ref: musyawarah-marketplace-draft.md §1b, §1c (sebagian), §2.
--
-- LINGKUP FASE INI
-- ----------------
-- - `messages.kind` / `messages.payload` (§1b) buat kartu listing & tawaran
--   nempel langsung di thread DM yang sudah ada.
-- - Tabel `orders` (§1c) — TAPI baris di sini cuma pernah berstatus 'pending'
--   di fase ini (dibuat pas `accept_offer`). Kolom `escrow_wallet` /
--   `lock_tx_hash` / `locked_at` / dst tetap ada dari sekarang (skema penuh
--   sesuai draft), tapi baru KEISI di Fase 3 (`lock_escrow_order`, belum
--   ditulis di migrasi ini). Satu penyesuaian dari draf mentah: kolom
--   `escrow_wallet` di sini dibikin NULLABLE (bukan `not null` kayak di §1c) —
--   karena beda dari Ink (yang baru bikin baris `orders` pas escrow di-lock),
--   di sini order-nya dibuat lebih awal (pas offer di-accept, sebelum ada
--   escrow sama sekali), jadi kolom itu belum mungkin keisi di titik itu.
-- - RPC baru: `send_message`, `propose_offer`, `accept_offer`, `decline_offer`,
--   `mark_thread_read`. Menutup celah lama: `messages` sekarang WAJIB ditulis
--   lewat RPC (`security definer`), bukan `.insert()`/`.update()` langsung
--   dari klien — hak INSERT/UPDATE dicabut dari anon/authenticated di bagian
--   akhir file ini (pola sama kayak 002_harden_writes.sql).
-- - `reviews` dan RPC lock/complete/release TETAP belum ada — itu Fase 3/4.
--
-- KETERBATASAN YANG MASIH ADA (baca ini, sama kayak catatan di 002!)
-- -------------------------------------------------------------------
-- Belum ada wallet-auth beneran (signature). `p_caller_wallet`/`p_sender`
-- cuma "dipercaya" dari parameter yang dikirim klien — siapa pun yang tau
-- alamat wallet orang lain masih bisa manggil RPC ini pura-pura jadi wallet
-- itu lewat DevTools. Sama persis keterbatasan yang sudah dicatat di
-- 002_harden_writes.sql dan 006_marketplace_listings.sql, belum ada yang
-- baru di sini.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom baru di `messages` (§1b)
-- ----------------------------------------------------------------------------
alter table messages add column if not exists kind text not null default 'text';
alter table messages add column if not exists payload jsonb;

alter table messages drop constraint if exists messages_kind_check;
alter table messages add constraint messages_kind_check
  check (kind in ('text', 'listing_ref', 'offer', 'order_update'));

create index if not exists idx_messages_kind on messages (kind) where kind <> 'text';

-- ----------------------------------------------------------------------------
-- 2. Tabel `orders` (§1c, dengan penyesuaian escrow_wallet nullable — lihat
--    catatan di header file ini)
-- ----------------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete restrict,
  buyer_wallet text not null,
  provider_wallet text not null,
  amount numeric not null check (amount > 0),
  coin_symbol text not null default 'UCT',
  escrow_wallet text,                 -- diisi Fase 3 (lock_escrow_order), dari env server-side
  lock_tx_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'locked', 'completed', 'released', 'disputed')),
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  released_at timestamptz,
  check (buyer_wallet <> provider_wallet)
);

create index if not exists orders_buyer_idx on orders (buyer_wallet);
create index if not exists orders_provider_idx on orders (provider_wallet);
create index if not exists orders_post_idx on orders (post_id);

-- RLS: baca publik (dipakai buat kartu order_update & MarketplacePage nanti
-- di Fase 4), tulis CUMA lewat RPC (security definer) sejak awal — beda dari
-- posts/tips/dst yang tadinya longgar terus baru dikencengin, tabel ini
-- baru dibuat sekarang jadi langsung dibikin ketat.
alter table orders enable row level security;

drop policy if exists "public read orders" on orders;
create policy "public read orders" on orders for select using (true);

revoke insert, update, delete on orders from anon, authenticated;
grant select on orders to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. send_message() — pengganti insert langsung ke `messages`. Cuma buat
--    kind 'text' & 'listing_ref' (offer/order_update punya RPC sendiri di
--    bawah supaya bentuk payload-nya konsisten & tervalidasi).
-- ----------------------------------------------------------------------------
create or replace function send_message(
  p_sender text,
  p_receiver text,
  p_content text default null,
  p_kind text default 'text',
  p_payload jsonb default null
)
returns messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content text := trim(coalesce(p_content, ''));
  v_post posts%rowtype;
  v_post_id uuid;
  v_message messages;
begin
  if p_sender is null or p_receiver is null or length(p_sender) = 0 or length(p_receiver) = 0 then
    raise exception 'both wallets are required';
  end if;
  if p_sender = p_receiver then
    raise exception 'cannot message yourself';
  end if;
  if p_kind not in ('text', 'listing_ref') then
    raise exception 'send_message only supports kind text or listing_ref (use propose_offer/accept_offer/decline_offer for offers)';
  end if;

  if p_kind = 'listing_ref' then
    v_post_id := (p_payload ->> 'post_id')::uuid;
    if v_post_id is null then
      raise exception 'payload.post_id is required for kind listing_ref';
    end if;

    select * into v_post from posts where id = v_post_id and is_listing;
    if v_post.id is null then
      raise exception 'listing not found';
    end if;

    -- pengirim/penerima harus salah satunya provider listing ini, biar
    -- kartu listing yang nempel di chat beneran relevan sama percakapannya.
    if v_post.author_wallet <> p_sender and v_post.author_wallet <> p_receiver then
      raise exception 'this listing does not belong to either participant of this conversation';
    end if;

    if v_content = '' then
      v_content := format('Shared a listing: %s', v_post.listing_title);
    end if;
  else
    if v_content = '' then
      raise exception 'message content cannot be empty';
    end if;
  end if;

  if length(v_content) > 1000 then
    raise exception 'message exceeds 1000 characters';
  end if;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    p_sender, p_receiver, v_content, p_kind,
    case when p_kind = 'listing_ref' then jsonb_build_object('post_id', v_post_id) else null end
  )
  returning * into v_message;

  return v_message;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. propose_offer() — kirim tawaran harga, nempel di thread yang sama
--    sebagai message kind='offer'. Bisa dipanggil dari kedua sisi (buyer
--    ATAU provider yang mulai duluan), beda dari Ink yang cuma nyimpen satu
--    angka "agreed_price" di thread (last-write-wins).
-- ----------------------------------------------------------------------------
create or replace function propose_offer(
  p_sender text,
  p_receiver text,
  p_post_id uuid,
  p_amount numeric,
  p_coin_symbol text default 'UCT'
)
returns messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post posts%rowtype;
  v_coin text := coalesce(nullif(trim(p_coin_symbol), ''), 'UCT');
  v_content text;
  v_message messages;
begin
  if p_sender is null or p_receiver is null or length(p_sender) = 0 or length(p_receiver) = 0 then
    raise exception 'both wallets are required';
  end if;
  if p_sender = p_receiver then
    raise exception 'cannot send an offer to yourself';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be greater than 0';
  end if;

  select * into v_post from posts where id = p_post_id and is_listing;
  if v_post.id is null then
    raise exception 'listing not found';
  end if;
  if v_post.author_wallet <> p_sender and v_post.author_wallet <> p_receiver then
    raise exception 'this listing does not belong to either participant of this conversation';
  end if;

  v_content := format('Offered %s %s for "%s"', p_amount, v_coin, v_post.listing_title);

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    p_sender, p_receiver, v_content, 'offer',
    jsonb_build_object(
      'post_id', p_post_id,
      'amount', p_amount,
      'coin_symbol', v_coin,
      'status', 'pending'
    )
  )
  returning * into v_message;

  return v_message;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. accept_offer() — HARUS dipanggil sama penerima tawaran (lawan bicara
--    pengirim), bukan last-write-wins kayak Ink. Bikin baris `orders` status
--    'pending' + kirim pesan sistem `order_update` otomatis di thread yang
--    sama.
-- ----------------------------------------------------------------------------
create or replace function accept_offer(
  p_message_id uuid,
  p_caller_wallet text
)
returns messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer messages%rowtype;
  v_post posts%rowtype;
  v_post_id uuid;
  v_amount numeric;
  v_coin text;
  v_buyer text;
  v_provider text;
  v_order orders;
  v_updated messages;
begin
  select * into v_offer from messages where id = p_message_id and kind = 'offer';
  if v_offer.id is null then
    raise exception 'offer not found';
  end if;
  if v_offer.payload ->> 'status' <> 'pending' then
    raise exception 'this offer has already been % ', v_offer.payload ->> 'status';
  end if;
  if p_caller_wallet is null or p_caller_wallet <> v_offer.receiver_wallet then
    raise exception 'only the recipient of this offer can accept it';
  end if;

  v_post_id := (v_offer.payload ->> 'post_id')::uuid;
  v_amount := (v_offer.payload ->> 'amount')::numeric;
  v_coin := coalesce(v_offer.payload ->> 'coin_symbol', 'UCT');

  select * into v_post from posts where id = v_post_id;
  if v_post.id is null then
    raise exception 'listing no longer exists';
  end if;

  v_provider := v_post.author_wallet;
  v_buyer := case when v_offer.sender_wallet = v_provider then v_offer.receiver_wallet else v_offer.sender_wallet end;

  if v_buyer = v_provider then
    raise exception 'could not determine buyer for this offer';
  end if;

  insert into orders (post_id, buyer_wallet, provider_wallet, amount, coin_symbol, status)
  values (v_post_id, v_buyer, v_provider, v_amount, v_coin, 'pending')
  returning * into v_order;

  update messages
  set payload = payload || jsonb_build_object('status', 'accepted', 'order_id', v_order.id)
  where id = p_message_id
  returning * into v_updated;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    v_provider, v_buyer,
    format('Order created for %s %s — waiting for escrow lock.', v_amount, v_coin),
    'order_update',
    jsonb_build_object('order_id', v_order.id, 'status', 'pending')
  );

  return v_updated;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. decline_offer() — murah buat ditambah sekalian (draft §8), sama syarat
--    caller-nya kayak accept_offer.
-- ----------------------------------------------------------------------------
create or replace function decline_offer(
  p_message_id uuid,
  p_caller_wallet text
)
returns messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer messages%rowtype;
  v_updated messages;
begin
  select * into v_offer from messages where id = p_message_id and kind = 'offer';
  if v_offer.id is null then
    raise exception 'offer not found';
  end if;
  if v_offer.payload ->> 'status' <> 'pending' then
    raise exception 'this offer has already been %', v_offer.payload ->> 'status';
  end if;
  if p_caller_wallet is null or p_caller_wallet <> v_offer.receiver_wallet then
    raise exception 'only the recipient of this offer can decline it';
  end if;

  update messages
  set payload = payload || jsonb_build_object('status', 'declined')
  where id = p_message_id
  returning * into v_updated;

  return v_updated;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. mark_thread_read() — pengganti `.update({read: true})` langsung dari
--    ThreadView, karena hak UPDATE ke `messages` dicabut di bagian 8.
-- ----------------------------------------------------------------------------
create or replace function mark_thread_read(
  p_wallet text,
  p_other_wallet text
)
returns void
language sql
security definer
set search_path = public
as $$
  update messages
  set read = true
  where receiver_wallet = p_wallet
    and sender_wallet = p_other_wallet
    and read = false;
$$;

-- ----------------------------------------------------------------------------
-- 8. Cabut hak tulis langsung ke `messages` (nutup celah lama yang dicatat
--    di README), sisain hak baca. Sama pola persis kayak 002_harden_writes.sql.
-- ----------------------------------------------------------------------------
revoke insert, update, delete on messages from anon, authenticated;
grant select on messages to anon, authenticated;

grant execute on function send_message(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function propose_offer(text, text, uuid, numeric, text) to anon, authenticated;
grant execute on function accept_offer(uuid, text) to anon, authenticated;
grant execute on function decline_offer(uuid, text) to anon, authenticated;
grant execute on function mark_thread_read(text, text) to anon, authenticated;
