-- MUSYAWARAH — 013: auto-decline tawaran basi + reminder konfirmasi escrow
-- ============================================================================
-- Jalankan file ini SETELAH 012_block_offers_on_inactive_listings.sql, di
-- Supabase Dashboard -> SQL Editor. Aman dijalankan berkali-kali (idempotent).
--
-- LINGKUP FASE INI
-- ----------------
-- Dua fungsi baru yang jalannya BUKAN dipicu klik user, tapi HARUS dipanggil
-- berkala oleh scheduler (lihat bagian 5 di bawah) — beda dari semua RPC
-- lain di project ini yang selalu dipicu aksi user:
--
--   1. `auto_decline_expired_offers()` — tawaran (`messages.kind = 'offer'`)
--      yang masih `status: 'pending'` dan sudah lebih dari 3 JAM sejak
--      dikirim, otomatis di-set jadi `status: 'declined'`, persis kayak kalau
--      penerimanya manggil `decline_offer()` sendiri. Kartu tawaran di chat
--      bakal kelihatan "Declined" plus ada pesan sistem baru di thread yang
--      sama ngejelasin itu auto-decline (bukan penerima yang nolak manual).
--
--   2. `send_escrow_confirmation_reminders()` — buat order yang statusnya
--      `'locked'` (buyer sudah lock escrow) tapi buyer BELUM
--      `confirm_order_complete()`:
--        - Reminder PERTAMA muncul begitu sudah 1 JAM sejak `locked_at`.
--        - Reminder ULANG tiap 6 JAM berikutnya selama order masih `'locked'`
--          (dilacak lewat kolom baru `orders.last_reminder_at`).
--        - Berhenti otomatis kalau sudah lebih dari 24 JAM sejak `locked_at`
--          (order dianggap butuh eskalasi manual/dispute, bukan reminder
--          rutin lagi) — dan tentu saja berhenti begitu order pindah status
--          dari `'locked'` (buyer confirm -> 'completed', atau dispute).
--      Reminder dikirim ke DUA BELAH PIHAK (buyer & provider) lewat tabel
--      `notifications` yang sudah ada (dipakai jg buat follow/repost/tip),
--      dengan tipe baru `'order_reminder'` + kolom `body` berisi detail
--      transaksinya (nomor order, judul listing, jumlah+koin, kapan
--      di-lock) — bukan cuma "ada aktivitas" kosong kayak notif lain.
--
-- KENAPA BUKAN RPC BIASA (TIDAK di-grant ke anon/authenticated)
-- ---------------------------------------------------------------------------
-- Semua RPC lain di project ini (`accept_offer`, `lock_escrow_order`, dst)
-- di-grant ke anon/authenticated karena memang dipicu SATU user buat AKSI
-- dia sendiri. Dua fungsi di sini beda: sekali dipanggil, dia MEMPROSES
-- SEMUA order/tawaran milik SEMUA user sekaligus. Kalau di-grant ke
-- anon/authenticated, sembarang wallet bisa manggilnya lewat DevTools buat
-- MAKSA tawaran orang lain langsung declined atau mancing reminder muncul
-- lebih cepat dari jadwalnya. Makanya di bagian 5, EXECUTE cuma di-grant ke
-- `service_role` (kunci server-side/dashboard), BUKAN anon/authenticated.
--
-- KETERBATASAN YANG MASIH ADA
-- ---------------------------------------------------------------------------
-- - Ini backend murni, belum ada perubahan UI. Kartu offer yang auto-declined
--   otomatis kebaca "Declined" di kartu offer yang sudah ada (kode React
--   nggak bedain declined manual vs auto), dan notif 'order_reminder' baru
--   BELUM dirender khusus di NotificationsPage.tsx — lihat catatan terpisah
--   soal itu di komponen React (butuh update kecil supaya body-nya tampil).
-- - Kalau `pg_cron` extension belum di-enable di project Supabase ini (Cek:
--   Dashboard -> Database -> Extensions -> cari "pg_cron"), blok DO di
--   bagian 5 otomatis SKIP (no-op, tidak error) — kedua fungsi tetap ADA dan
--   BISA dipanggil manual dari SQL Editor buat tes, tapi TIDAK akan jalan
--   otomatis tiap X menit sampai salah satu dari ini dilakukan:
--     (a) enable pg_cron lalu jalankan ULANG migrasi ini, ATAU
--     (b) jadwalin lewat scheduler eksternal (mis. GitHub Actions / cron
--         job server) yang manggil kedua fungsi ini via Supabase RPC
--         (`POST /rest/v1/rpc/auto_decline_expired_offers`) pakai
--         SERVICE ROLE KEY (bukan anon key — lihat bagian "kenapa bukan RPC
--         biasa" di atas).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom baru di `orders` — nge-lacak kapan reminder TERAKHIR dikirim buat
--    order ini, biar `send_escrow_confirmation_reminders()` tau kapan harus
--    kirim reminder berikutnya (tiap 6 jam) dan gak dobel kirim.
-- ----------------------------------------------------------------------------
alter table orders add column if not exists last_reminder_at timestamptz;

-- ----------------------------------------------------------------------------
-- 2. Kolom baru di `notifications` — `order_id` (link balik ke order yang
--    lagi diingetin) dan `body` (teks detail transaksi yang sudah jadi,
--    dikomposisi di server pas notif dibikin, BUKAN dirakit ulang di klien
--    kayak notif follow/repost/tip yang cuma nyimpen actor+type+post_id).
-- ----------------------------------------------------------------------------
alter table notifications add column if not exists order_id uuid references orders (id) on delete cascade;
alter table notifications add column if not exists body text;

create index if not exists idx_notifications_order on notifications (order_id) where order_id is not null;

-- ----------------------------------------------------------------------------
-- 3. Perbarui CHECK constraint di `notifications` biar nerima tipe baru
--    'order_reminder'. Nama constraint yang di-generate otomatis pas
--    `create table` di schema.sql TIDAK dijamin `notifications_type_check` /
--    `notifications_check` (tergantung versi Postgres) — makanya di sini
--    di-drop SEMUA check constraint yang lagi nempel di tabel ini (apa pun
--    namanya) lalu diganti dengan dua constraint baru yang dikasih nama
--    eksplisit, biar migrasi berikutnya (kalau ada) gak nebak-nebak lagi.
-- ----------------------------------------------------------------------------
do $$
declare
  v_conname text;
begin
  for v_conname in
    select conname from pg_constraint
    where conrelid = 'notifications'::regclass and contype = 'c'
  loop
    execute format('alter table notifications drop constraint %I', v_conname);
  end loop;
end $$;

alter table notifications add constraint notifications_type_check
  check (type in ('follow', 'repost', 'tip', 'order_reminder'));

alter table notifications add constraint notifications_payload_check
  check (
    (type = 'follow' and post_id is null and amount is null and order_id is null)
    or (type = 'repost' and post_id is not null and amount is null and order_id is null)
    or (type = 'tip' and post_id is not null and amount is not null and order_id is null)
    or (type = 'order_reminder' and order_id is not null and amount is not null and body is not null)
  );

-- ----------------------------------------------------------------------------
-- 4a. auto_decline_expired_offers()
--     Tawaran pending > 3 jam -> declined otomatis. Guard
--     `payload ->> 'status' = 'pending'` di klausa UPDATE (bukan cuma di
--     SELECT loop) supaya kalau penerimanya SEMPAT accept/decline manual
--     tepat di detik yang sama fungsi ini jalan, baris itu dilewatin
--     (row_count = 0) bukan ketimpa jadi 'declined' padahal udah diputusin.
-- ----------------------------------------------------------------------------
create or replace function auto_decline_expired_offers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer messages%rowtype;
  v_rows integer;
  v_count integer := 0;
begin
  for v_offer in
    select * from messages
    where kind = 'offer'
      and payload ->> 'status' = 'pending'
      and created_at < now() - interval '3 hours'
    order by created_at
  loop
    update messages
    set payload = payload || jsonb_build_object('status', 'declined', 'declined_reason', 'expired')
    where id = v_offer.id
      and payload ->> 'status' = 'pending';

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      continue; -- sudah diputusin manual barusan, skip
    end if;

    insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
    values (
      v_offer.receiver_wallet, v_offer.sender_wallet,
      'Offer automatically declined — no response within 3 hours.',
      'order_update',
      jsonb_build_object('offer_id', v_offer.id, 'status', 'auto_declined')
    );

    v_count := v_count + 1;
  end loop;

  return v_count; -- jumlah tawaran yang di-auto-decline, berguna buat log scheduler
end;
$$;

-- ----------------------------------------------------------------------------
-- 4b. send_escrow_confirmation_reminders()
--     Jendela reminder: mulai 1 jam, ulang tiap 6 jam, berhenti > 24 jam
--     sejak `locked_at` — SEMUA dicek relatif ke `locked_at`, bukan relatif
--     ke reminder sebelumnya, jadi jadwalnya tetap konsisten
--     (1j, 7j, 13j, 19j sejak lock) walau fungsi ini dipanggil sesering
--     apa pun oleh scheduler. Guard UPDATE (klaim baris dulu, baru insert
--     notif) sama polanya kayak 4a — nyegah dobel kirim kalau overlap run.
-- ----------------------------------------------------------------------------
create or replace function send_escrow_confirmation_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_post posts%rowtype;
  v_body text;
  v_rows integer;
  v_count integer := 0;
begin
  for v_order in
    select * from orders
    where status = 'locked'
      and locked_at <= now() - interval '1 hour'
      and locked_at >= now() - interval '24 hours'
      and (last_reminder_at is null or last_reminder_at <= now() - interval '6 hours')
    order by locked_at
  loop
    update orders
    set last_reminder_at = now()
    where id = v_order.id
      and status = 'locked'
      and (last_reminder_at is null or last_reminder_at <= now() - interval '6 hours')
    returning * into v_order;

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      continue; -- udah diklaim run lain, atau statusnya berubah barusan
    end if;

    select * into v_post from posts where id = v_order.post_id;

    v_body := format(
      'Reminder: order #%s for "%s" (%s %s) is still waiting for buyer confirmation. Buyer %s · Seller %s · Escrow locked %s UTC.',
      left(v_order.id::text, 8),
      coalesce(v_post.listing_title, 'this listing'),
      v_order.amount,
      v_order.coin_symbol,
      left(v_order.buyer_wallet, 6) || '…' || right(v_order.buyer_wallet, 4),
      left(v_order.provider_wallet, 6) || '…' || right(v_order.provider_wallet, 4),
      to_char(v_order.locked_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI')
    );

    -- Ke buyer (yang belum confirm) -- actor ditampilin sebagai seller,
    -- biar avatar/nama yang nongol di kartu notif relevan (lawan transaksinya).
    insert into notifications (recipient_wallet, actor_wallet, type, post_id, amount, order_id, body)
    values (v_order.buyer_wallet, v_order.provider_wallet, 'order_reminder', v_order.post_id, v_order.amount, v_order.id, v_body);

    -- Ke seller juga (biar dia tau transaksinya masih ngegantung nunggu buyer).
    insert into notifications (recipient_wallet, actor_wallet, type, post_id, amount, order_id, body)
    values (v_order.provider_wallet, v_order.buyer_wallet, 'order_reminder', v_order.post_id, v_order.amount, v_order.id, v_body);

    v_count := v_count + 1;
  end loop;

  return v_count; -- jumlah order yang baru dikirimin reminder, berguna buat log scheduler
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Jadwal otomatis via pg_cron (kalau extension-nya di-enable) + hak akses.
--    LIHAT catatan "KENAPA BUKAN RPC BIASA" di header file ini -- EXECUTE
--    SENGAJA cuma buat service_role, TIDAK buat anon/authenticated.
-- ----------------------------------------------------------------------------
revoke all on function auto_decline_expired_offers() from public, anon, authenticated;
revoke all on function send_escrow_confirmation_reminders() from public, anon, authenticated;
grant execute on function auto_decline_expired_offers() to service_role;
grant execute on function send_escrow_confirmation_reminders() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- unschedule dulu kalau udah pernah dipasang migrasi ini sebelumnya, biar
    -- re-run file ini idempotent (gak numpuk job duplikat). SENGAJA pakai
    -- `cron.unschedule()` (fungsi bawaan pg_cron), BUKAN `delete from
    -- cron.job` langsung -- role `postgres` yang dipakai SQL Editor Supabase
    -- nggak punya hak DELETE langsung ke tabel `cron.job` (cuma lewat fungsi
    -- ini yang jalan sebagai security definer), jadi DELETE mentah bakal
    -- selalu gagal dengan "permission denied for table job" biarpun baris
    -- yang mau dihapus itu ada atau nggak.
    if exists (select 1 from cron.job where jobname = 'musyawarah_auto_decline_expired_offers') then
      perform cron.unschedule('musyawarah_auto_decline_expired_offers');
    end if;
    if exists (select 1 from cron.job where jobname = 'musyawarah_send_escrow_confirmation_reminders') then
      perform cron.unschedule('musyawarah_send_escrow_confirmation_reminders');
    end if;

    -- Tiap 5 menit cukup buat presisi "dalam 3 jam" tanpa bebani DB.
    perform cron.schedule(
      'musyawarah_auto_decline_expired_offers',
      '*/5 * * * *',
      'select auto_decline_expired_offers();'
    );

    -- Tiap 15 menit -- window reminder (1 jam pertama, ulang 6 jam) cukup
    -- toleran terhadap keterlambatan sampai seperempat jam.
    perform cron.schedule(
      'musyawarah_send_escrow_confirmation_reminders',
      '*/15 * * * *',
      'select send_escrow_confirmation_reminders();'
    );
  end if;
end $$;
