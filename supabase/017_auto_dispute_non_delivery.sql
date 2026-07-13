-- MUSYAWARAH — 017: auto-dispute order locked yang seller-nya nggak deliver
-- ============================================================================
-- Jalankan SETELAH 016_gate_confirm_on_deliverable.sql. Aman dijalankan
-- berkali-kali (idempotent).
--
-- LATAR
-- -----
-- 013 sudah bikin `send_escrow_confirmation_reminders()` yang reminder-nya
-- berhenti otomatis begitu lewat 24 jam sejak `locked_at` — dan komentar di
-- file itu SUDAH bilang eksplisit alasannya: "order dianggap butuh eskalasi
-- manual/dispute, bukan reminder rutin lagi". Tapi niat itu belum pernah
-- benar-benar dieksekusi — order-nya sendiri dibiarkan nyangkut selamanya di
-- status 'locked' tanpa penanda apa pun kalau butuh perhatian. Migrasi ini
-- menutup celah itu, KHUSUS untuk kasus paling parah: seller belum submit
-- `deliverable_url` sama sekali (015) sampai window 24 jam itu lewat — bukan
-- kasus "seller udah kirim, buyer aja yang lambat confirm" (itu tetap
-- dibiarkan seperti sekarang, sudah di-cover reminder 013).
--
-- KENAPA 24 JAM (bukan angka baru)
-- ---------------------------------------------------------------------------
-- Sengaja DIPERSAMAKAN dengan titik di mana 013 sudah berhenti reminder,
-- bukan angka independen — biar satu window waktu yang sama berlaku
-- konsisten buat "kapan sistem berhenti menganggap ini kasus normal" di
-- SELURUH lifecycle order 'locked', baik dari sisi buyer (013) maupun sisi
-- seller (file ini). Kronologi lengkap sejak lock:
--   1 jam   -> reminder pertama ke buyer & seller (013)
--   7/13/19 jam -> reminder ulang tiap 6 jam (013)
--   24 jam  -> reminder BERHENTI (013) DAN, kalau seller belum submit
--              deliverable sama sekali, order auto pindah ke 'disputed'
--              (file ini) -- dua-duanya jalan di titik yang sama, on purpose.
--
-- APA YANG BERUBAH DI ORDER
-- ---------------------------------------------------------------------------
-- Cuma `status -> 'disputed'` + `disputed_at` + `dispute_reason` terisi, plus
-- 1 pesan `order_update` di thread (pola sama kayak SEMUA fungsi status-
-- changing lain di project ini -- cancel_order, mark_order_delivered, dst --
-- yang selalu nembak chip ke thread biar riwayatnya kebaca di chat). TIDAK
-- ada entry baru di tabel `notifications` di sini -- beda dari 013 yang
-- memang notifikasi terus-menerus, dispute ini SEKALI pindah status lalu
-- diam (chip di thread sudah cukup buat nandain, lonceng notifikasi
-- dianggap belum perlu buat fase ini).
--
-- KETERBATASAN YANG MASIH ADA
-- ---------------------------------------------------------------------------
-- - Status 'disputed' di sini PURE PENANDA -- belum ada RPC penyelesaian
--   dispute (refund ke buyer / force-release ke seller / dst). Operator
--   masih harus menyelesaikannya manual lewat SQL Editor (update `orders`
--   langsung), sama kayak `mark_order_released` di 008 yang juga sengaja
--   tanpa UI.
-- - Sama seperti auto_decline_expired_offers & send_escrow_confirmation_
--   reminders di 013: fungsi ini BUKAN dipicu klik user, jadi EXECUTE cuma
--   di-grant ke service_role, dan butuh scheduler (pg_cron kalau ada, atau
--   external cron via service role key) buat jalan otomatis -- lihat bagian
--   "KENAPA BUKAN RPC BIASA" di header 013 untuk alasan lengkapnya.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom baru di `orders` -- kapan order ini di-auto-dispute + alasannya
--    (dibikin kolom terpisah, bukan cuma disisipkan ke pesan, biar gampang
--    di-query "daftar order disputed karena non-delivery" tanpa parse teks).
-- ----------------------------------------------------------------------------
alter table orders add column if not exists disputed_at timestamptz;
alter table orders add column if not exists dispute_reason text;

-- ----------------------------------------------------------------------------
-- 2. auto_dispute_non_delivery()
--    Kandidat: status = 'locked', deliverable_url masih kosong, locked_at
--    sudah lebih dari 24 jam. Guard UPDATE (klaim baris dulu via
--    status = 'locked' di klausa WHERE, bukan cuma di SELECT loop) --
--    pola sama persis kayak 4a/4b di 013, nyegah race kalau overlap run
--    scheduler atau seller sempat submit deliverable tepat di detik yang
--    sama fungsi ini jalan.
-- ----------------------------------------------------------------------------
create or replace function auto_dispute_non_delivery()
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
    where status = 'locked'
      and deliverable_url is null
      and locked_at <= now() - interval '24 hours'
    order by locked_at
  loop
    update orders
    set status = 'disputed',
        disputed_at = now(),
        dispute_reason = 'seller_no_delivery_24h'
    where id = v_order.id
      and status = 'locked'
      and deliverable_url is null
    returning * into v_order;

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      continue; -- seller sempat submit deliverable / status berubah barusan, skip
    end if;

    insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
    values (
      v_order.buyer_wallet, v_order.provider_wallet,
      'Order automatically flagged for dispute — no deliverable submitted within 24 hours of escrow lock.',
      'order_update',
      jsonb_build_object('order_id', v_order.id, 'status', 'disputed', 'dispute_reason', 'seller_no_delivery_24h')
    );

    v_count := v_count + 1;
  end loop;

  return v_count; -- jumlah order yang baru di-auto-dispute, berguna buat log scheduler
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Hak akses + jadwal pg_cron -- sama persis pola 013 bagian 5.
-- ----------------------------------------------------------------------------
revoke all on function auto_dispute_non_delivery() from public, anon, authenticated;
grant execute on function auto_dispute_non_delivery() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'musyawarah_auto_dispute_non_delivery') then
      perform cron.unschedule('musyawarah_auto_dispute_non_delivery');
    end if;

    -- Tiap 15 menit -- sama cadence-nya kayak musyawarah_send_escrow_
    -- confirmation_reminders di 013, karena keduanya "berbagi" titik 24 jam
    -- yang sama dan enak buat dibandingkan log-nya kalau ada masalah.
    perform cron.schedule(
      'musyawarah_auto_dispute_non_delivery',
      '*/15 * * * *',
      'select auto_dispute_non_delivery();'
    );
  end if;
end $$;
