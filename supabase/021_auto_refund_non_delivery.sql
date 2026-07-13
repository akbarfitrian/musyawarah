-- MUSYAWARAH — 021: nutup ujung dispute non-delivery (auto-flag + refund manual)
-- ============================================================================
-- Jalankan SETELAH 020_single_dispute_limit.sql. Aman dijalankan berkali-kali
-- (idempotent).
--
-- LATAR
-- -----
-- 017 auto-pindah order ke `disputed` (`seller_no_delivery_24h`) kalau
-- seller belum submit deliverable 24 jam sejak lock. Seller BOLEH balas
-- lewat `submit_deliverable_revision` (019) kapan saja selama status masih
-- `disputed`, tanpa batas waktu — tapi kalau seller TETAP diam setelah itu,
-- order nyangkut selamanya, TIDAK ada jalan keluar otomatis. Satu-satunya
-- opsi sebelum migrasi ini: operator turun tangan manual lewat SQL Editor,
-- tanpa penanda apa pun soal order mana yang sudah "cukup lama" didiamkan.
-- Migrasi ini menutup itu, KHUSUS untuk kasus non-delivery (bukan sengketa
-- kualitas `buyer_quality_dispute` — itu tetap diselesaikan lewat rating,
-- sesuai keputusan produk di 020, bukan refund otomatis).
--
-- KENAPA 24 JAM LAGI (bukan angka baru, bukan langsung refund saat dispute)
-- ---------------------------------------------------------------------------
-- Dipinjam dari cadence yang sudah ada di 013/017 (bukan angka independen),
-- jadi total waktu dari lock sampai order ditandai siap-refund adalah 48
-- jam: 24 jam pertama buat seller submit deliverable sama sekali (017),
-- lalu 24 jam KEDUA buat seller merespons dispute-nya dengan revisi (019)
-- sebelum ditandai. Sengaja tidak langsung refund detik order jadi
-- `disputed` — grace period kedua ini kasih seller kesempatan terakhir yang
-- jelas batas waktunya, konsisten sama pola "beri jendela sebelum eskalasi"
-- yang dipakai di seluruh lifecycle order ini (013 -> 017 -> sini).
--
-- KENAPA TANDAI DULU, BUKAN LANGSUNG UBAH STATUS/REFUND
-- ---------------------------------------------------------------------------
-- Platform ini escrow-nya custodial dengan crypto beneran ke treasury
-- wallet (lihat 008) — bukan smart contract yang bisa auto-refund sendiri.
-- Konsisten sama `mark_order_released` (008, release SELALU manual oleh
-- operator), refund pun harus lewat operator: sistem cuma MENANDAI order
-- yang sudah lewat window kedua ini (`refund_flagged_at`), operator yang
-- benar-benar mengirim crypto balik ke buyer lalu mencatatnya lewat
-- `mark_order_refunded` di bawah. Menandai (bukan mengubah status) juga
-- sengaja TIDAK menutup pintu seller — `submit_deliverable_revision` (019)
-- tetap bisa dipanggil kapan saja selama status masih `disputed`, termasuk
-- SETELAH ditandai, sampai operator benar-benar mengeksekusi refund.
--
-- KENAPA CUMA 1x TANDAI LALU DIAM (bukan reminder berulang kayak 013)
-- ---------------------------------------------------------------------------
-- Beda dari 013 (yang memang butuh reminder berulang karena tujuannya
-- mendorong aksi buyer/seller), di titik ini siapa yang "salah" sudah
-- jelas (seller tidak pernah deliver, lalu tidak merespons dispute) — yang
-- dibutuhkan cuma SATU sinyal ke operator bahwa order ini butuh perhatian,
-- konsisten sama pola `auto_dispute_non_delivery` (017) yang juga cuma
-- sekali pindah status lalu diam, bukan notifikasi terus-menerus.
--
-- WAJIB DI-FLAG DULU SEBELUM REFUND (keputusan produk)
-- ---------------------------------------------------------------------------
-- `mark_order_refunded` MEWAJIBKAN `refund_flagged_at is not null` — operator
-- tidak bisa refund order yang belum melewati window 48 jam ini, sama
-- ketatnya seperti `mark_order_released` yang divalidasi terhadap treasury
-- wallet. Ini sengaja membuat refund selalu auditable lewat 1 jalur, bukan
-- diskresi bebas kapan saja.
--
-- KETERBATASAN YANG MASIH ADA
-- ---------------------------------------------------------------------------
-- - Sama seperti 017/018: `auto_flag_refund_eligible_disputes` BUKAN
--   dipicu klik user, EXECUTE cuma di-grant ke service_role, butuh
--   scheduler (pg_cron kalau ada, atau external cron via service role key).
-- - `mark_order_refunded`, sama seperti `mark_order_released` (008), tidak
--   memindahkan crypto beneran — cuma mencatat state setelah operator
--   mengirim dana secara manual. Belum ada UI Admin buat tombol ini
--   (konsisten sama `mark_order_released` yang juga sengaja tanpa UI).
-- - Kasus `buyer_quality_dispute` TIDAK pernah kena auto-flag di sini —
--   kalau macet, itu tetap ranah operator manual sepenuhnya (sama seperti
--   sebelum migrasi ini), karena bukan clear-cut fault seperti non-delivery.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom & status baru di `orders`.
-- ----------------------------------------------------------------------------
alter table orders add column if not exists refund_flagged_at timestamptz;
alter table orders add column if not exists refunded_at timestamptz;

alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('pending', 'locked', 'completed', 'released', 'disputed', 'cancelled', 'refunded'));

-- ----------------------------------------------------------------------------
-- 2. auto_flag_refund_eligible_disputes()
--    Kandidat: status = 'disputed', dispute_reason = 'seller_no_delivery_24h'
--    (bukan 'buyer_quality_dispute' -- lihat LATAR), deliverable_url masih
--    kosong (kalau seller sudah submit revisi, deliverable_url terisi DAN
--    status sudah balik ke 'locked' lewat 019 -- otomatis nggak lolos
--    kandidat ini lagi), disputed_at sudah lebih dari 24 jam, dan belum
--    pernah ditandai (refund_flagged_at is null, biar idempotent per order
--    -- sekali ditandai, nggak ditandai ulang tiap 15 menit).
--    Guard UPDATE sama polanya kayak 017/018: klaim baris dulu di WHERE.
-- ----------------------------------------------------------------------------
create or replace function auto_flag_refund_eligible_disputes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_rows integer;
  v_count integer := 0;
begin
  for v_order in
    select * from orders
    where status = 'disputed'
      and dispute_reason = 'seller_no_delivery_24h'
      and deliverable_url is null
      and refund_flagged_at is null
      and disputed_at <= now() - interval '24 hours'
    order by disputed_at
  loop
    update orders
    set refund_flagged_at = now()
    where id = v_order.id
      and status = 'disputed'
      and deliverable_url is null
      and refund_flagged_at is null
    returning * into v_order;

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      continue; -- seller sempat submit revisi / status berubah barusan, skip
    end if;

    insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
    values (
      v_order.buyer_wallet, v_order.provider_wallet,
      'Order flagged for refund — no response to the non-delivery dispute within 24 hours. An operator will process the refund.',
      'order_update',
      jsonb_build_object('order_id', v_order.id, 'status', 'disputed', 'refund_flagged_at', v_order.refund_flagged_at)
    );

    v_count := v_count + 1;
  end loop;

  return v_count; -- jumlah order yang baru ditandai, berguna buat log scheduler
end;
$$;

revoke all on function auto_flag_refund_eligible_disputes() from public, anon, authenticated;
grant execute on function auto_flag_refund_eligible_disputes() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'musyawarah_auto_flag_refund_eligible_disputes') then
      perform cron.unschedule('musyawarah_auto_flag_refund_eligible_disputes');
    end if;

    -- Tiap 15 menit -- cadence sama kayak fungsi periodik lain
    -- (musyawarah_send_escrow_confirmation_reminders,
    -- musyawarah_auto_dispute_non_delivery,
    -- musyawarah_auto_complete_unconfirmed_orders).
    perform cron.schedule(
      'musyawarah_auto_flag_refund_eligible_disputes',
      '*/15 * * * *',
      'select auto_flag_refund_eligible_disputes();'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. mark_order_refunded()
--    Paralel persis sama mark_order_released (008): operator-only lewat
--    validasi treasury constant, bukan lewat grant Postgres. Sengaja tanpa
--    UI (dipanggil manual lewat SQL Editor / RPC console), konsisten sama
--    mark_order_released.
--    Validasi tambahan (WAJIB, keputusan produk): refund_flagged_at harus
--    sudah terisi -- operator tidak bisa refund order yang belum lewat
--    window 48 jam ini, supaya refund selalu lewat 1 jalur auditable.
-- ----------------------------------------------------------------------------
create or replace function mark_order_refunded(
  p_order_id uuid,
  p_operator_wallet text
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Harus sama persis dengan v_treasury_wallet di lock_escrow_order() /
  -- mark_order_released() (008).
  v_treasury_wallet constant text := 'VITE_VERIFICATION_TREASURY_WALLET=@masyarakat';
  v_order orders;
  v_buyer text;
  v_provider text;
begin
  if p_operator_wallet is null or p_operator_wallet <> v_treasury_wallet then
    raise exception 'only the treasury/operator wallet can refund an order';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if v_order.status <> 'disputed' then
    raise exception 'order is not disputed (current status: %)', v_order.status;
  end if;
  if v_order.refund_flagged_at is null then
    raise exception 'order has not been flagged refund-eligible yet — wait for the 24h window after the dispute, or let auto_flag_refund_eligible_disputes() run';
  end if;

  v_buyer := v_order.buyer_wallet;
  v_provider := v_order.provider_wallet;

  update orders
  set status = 'refunded',
      refunded_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    v_provider, v_buyer,
    format('Escrowed payment of %s %s refunded to buyer by operator.', v_order.amount, v_order.coin_symbol),
    'order_update',
    jsonb_build_object('order_id', v_order.id, 'status', 'refunded')
  );

  return v_order;
end;
$$;

-- Sengaja di-grant ke anon/authenticated, sama alasannya kayak
-- mark_order_released (008 §4) -- proteksi "cuma operator" ada DI DALAM
-- fungsi (validasi p_operator_wallet vs treasury constant), bukan di
-- lapisan grant Postgres.
grant execute on function mark_order_refunded(uuid, text) to anon, authenticated;
