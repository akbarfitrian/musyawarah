-- MUSYAWARAH — 008: marketplace Fase 3.1 (RPC escrow backend murni, belum ada UI)
-- ============================================================================
-- Jalankan file ini SETELAH schema.sql, 002_harden_writes.sql, 003_quests.sql,
-- 004_top_tipped.sql, 005_top_tipped_posts.sql, 006_marketplace_listings.sql,
-- dan 007_marketplace_negotiation.sql, di Supabase Dashboard -> SQL Editor.
-- Aman dijalankan berkali-kali (idempotent).
--
-- Ref: musyawarah-marketplace-draft__1__pecah_fase_3.md §9, Fase 3.1.
--
-- LINGKUP FASE INI
-- ----------------
-- Cuma 3 RPC baru, SEMUANYA backend-only — tidak ada perubahan kode React di
-- migrasi ini. Ketiganya bisa dites langsung dari SQL Editor / Postman
-- (lewat PostgREST `rpc/...`) tanpa nyentuh UI sama sekali:
--   - `lock_escrow_order(p_order_id, p_buyer_wallet, p_lock_tx_hash)`
--   - `confirm_order_complete(p_order_id, p_buyer_wallet)`
--   - `mark_order_released(p_order_id, p_operator_wallet)`
-- Tombol "Lock escrow" & "Confirm task complete" di UI baru muncul di Fase
-- 3.2/3.3. `mark_order_released` SENGAJA tanpa UI selamanya (lihat draft §9
-- Fase 3.1) — dipanggil manual oleh operator lewat SQL editor, konsisten
-- sama proses release manual di Ink.
--
-- ACTION WAJIB SEBELUM/SESUDAH MENJALANKAN FILE INI
-- ---------------------------------------------------
-- Ganti placeholder `v_treasury_wallet` di KETIGA fungsi di bawah dengan
-- alamat wallet yang SAMA PERSIS dengan isi `VITE_VERIFICATION_TREASURY_WALLET`
-- di .env.local project ini (lihat draft, keputusan (b) — 1 wallet dipakai
-- dobel buat verifikasi & escrow). Kalau nilainya beda, `lock_escrow_order`
-- akan mencatat "terkirim" ke alamat yang salah dan `mark_order_released`
-- tidak akan pernah bisa dipanggil operator yang benar. Cara paling aman:
-- cari-ganti string 'REPLACE_WITH_TREASURY_WALLET_ADDRESS' di file ini
-- SEBELUM di-paste ke SQL Editor.
--
-- KETERBATASAN YANG MASIH ADA (sama kayak header 002/006/007 — dicatat ulang
-- biar konsisten, bukan hal baru di sini)
-- -------------------------------------------------------------------------
-- Belum ada wallet-auth beneran (signature). `p_buyer_wallet` /
-- `p_operator_wallet` cuma "dipercaya" dari parameter yang dikirim klien —
-- siapa pun yang tau alamat wallet orang lain masih bisa manggil RPC ini
-- pura-pura jadi wallet itu lewat DevTools. `p_operator_wallet` di
-- `mark_order_released` divalidasi ketat terhadap konstanta treasury di
-- server (bukan kolom `orders.escrow_wallet` seperti pola Ink), jadi
-- setidaknya tidak bisa dipanggil sembarang wallet — tapi kalau memang
-- wallet treasury itu sendiri bocor, sama saja rentan seperti RPC lain.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. lock_escrow_order()
--    Validasi: order.status = 'pending', p_buyer_wallet = order.buyer_wallet.
--    escrow_wallet diisi dari konstanta hardcoded di body fungsi (BUKAN
--    parameter dari client kayak punya Ink `record_escrow_lock`) — client
--    cuma boleh ngasih tau BAHWA dia udah kirim (p_lock_tx_hash), bukan
--    nentuin sendiri "ke wallet mana" dana itu dianggap terkirim.
-- ----------------------------------------------------------------------------
create or replace function lock_escrow_order(
  p_order_id uuid,
  p_buyer_wallet text,
  p_lock_tx_hash text
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  -- GANTI nilai ini biar sama persis dengan VITE_VERIFICATION_TREASURY_WALLET
  -- (.env.local) sebelum menjalankan migrasi ini di Supabase.
  v_treasury_wallet constant text := 'VITE_VERIFICATION_TREASURY_WALLET=@masyarakat';
  v_order orders;
  v_buyer text;
  v_provider text;
begin
  if p_buyer_wallet is null or length(trim(p_buyer_wallet)) = 0 then
    raise exception 'buyer wallet is required';
  end if;
  if p_lock_tx_hash is null or length(trim(p_lock_tx_hash)) = 0 then
    raise exception 'lock_tx_hash is required';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if v_order.buyer_wallet <> p_buyer_wallet then
    raise exception 'only the buyer on this order can lock escrow';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'order is not pending (current status: %)', v_order.status;
  end if;

  v_buyer := v_order.buyer_wallet;
  v_provider := v_order.provider_wallet;

  update orders
  set escrow_wallet = v_treasury_wallet,
      lock_tx_hash = p_lock_tx_hash,
      status = 'locked',
      locked_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    v_buyer, v_provider,
    format('Escrow locked for %s %s.', v_order.amount, v_order.coin_symbol),
    'order_update',
    jsonb_build_object('order_id', v_order.id, 'status', 'locked')
  );

  return v_order;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. confirm_order_complete()
--    Validasi: order.status = 'locked', p_buyer_wallet = order.buyer_wallet.
-- ----------------------------------------------------------------------------
create or replace function confirm_order_complete(
  p_order_id uuid,
  p_buyer_wallet text
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_buyer text;
  v_provider text;
begin
  if p_buyer_wallet is null or length(trim(p_buyer_wallet)) = 0 then
    raise exception 'buyer wallet is required';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if v_order.buyer_wallet <> p_buyer_wallet then
    raise exception 'only the buyer on this order can confirm completion';
  end if;
  if v_order.status <> 'locked' then
    raise exception 'order is not locked (current status: %)', v_order.status;
  end if;

  v_buyer := v_order.buyer_wallet;
  v_provider := v_order.provider_wallet;

  update orders
  set status = 'completed',
      completed_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    v_buyer, v_provider,
    'Buyer confirmed the task as complete.',
    'order_update',
    jsonb_build_object('order_id', v_order.id, 'status', 'completed')
  );

  return v_order;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. mark_order_released()
--    Validasi: order.status = 'completed', p_operator_wallet = konstanta
--    treasury wallet yang sama dipakai di lock_escrow_order (bukan
--    buyer_wallet/provider_wallet mana pun — cuma operator). Sengaja tanpa
--    UI (dipanggil manual lewat SQL editor / RPC console).
-- ----------------------------------------------------------------------------
create or replace function mark_order_released(
  p_order_id uuid,
  p_operator_wallet text
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Harus sama persis dengan v_treasury_wallet di lock_escrow_order() di atas.
  v_treasury_wallet constant text := 'VITE_VERIFICATION_TREASURY_WALLET=@masyarakat';
  v_order orders;
  v_buyer text;
  v_provider text;
begin
  if p_operator_wallet is null or p_operator_wallet <> v_treasury_wallet then
    raise exception 'only the treasury/operator wallet can release an order';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if v_order.status <> 'completed' then
    raise exception 'order is not completed (current status: %)', v_order.status;
  end if;

  v_buyer := v_order.buyer_wallet;
  v_provider := v_order.provider_wallet;

  update orders
  set status = 'released',
      released_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    v_provider, v_buyer,
    format('Payout of %s %s released by operator.', v_order.amount, v_order.coin_symbol),
    'order_update',
    jsonb_build_object('order_id', v_order.id, 'status', 'released')
  );

  return v_order;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Hak eksekusi. Sengaja SEMUA (termasuk mark_order_released) di-grant ke
--    anon/authenticated seperti pola RPC lain di project ini — proteksi
--    "cuma operator yang bisa release" ada di validasi p_operator_wallet vs
--    v_treasury_wallet DI DALAM fungsinya, bukan di lapisan grant Postgres
--    (operator memanggilnya lewat wallet yang sama seperti user biasa,
--    cuma alamatnya kebetulan cocok sama konstanta treasury).
-- ----------------------------------------------------------------------------
grant execute on function lock_escrow_order(uuid, text, text) to anon, authenticated;
grant execute on function confirm_order_complete(uuid, text) to anon, authenticated;
grant execute on function mark_order_released(uuid, text) to anon, authenticated;
