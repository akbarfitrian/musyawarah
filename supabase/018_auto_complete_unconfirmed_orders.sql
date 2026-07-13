-- MUSYAWARAH — 018: auto-complete order locked yang buyer-nya nggak kunjung
--                    confirm, padahal deliverable udah ada
-- ============================================================================
-- Jalankan SETELAH 017_auto_dispute_non_delivery.sql. Aman dijalankan
-- berkali-kali (idempotent).
--
-- LATAR
-- -----
-- 017 nutup celah "seller nggak pernah deliver". File ini nutup celah
-- pasangannya yang justru lebih sering kejadian di praktik: seller UDAH
-- submit deliverable_url (015), tapi buyer nggak kunjung klik "Confirm task
-- complete" -- entah lupa, sibuk, atau sengaja diemin. Sebelum migrasi ini,
-- begitu reminder 013 berhenti di jam ke-24, order jenis ini nyangkut
-- SELAMANYA di status 'locked' tanpa jalan keluar otomatis apa pun --
-- padahal dari sisi seller, dia sudah menuntaskan bagiannya dan cuma
-- nunggu satu klik yang nggak pernah datang.
--
-- KENAPA 72 JAM (bukan 24 jam kayak 017)
-- ---------------------------------------------------------------------------
-- Sengaja BEDA dari 017, dan sengaja lebih longgar (3x lipat), karena
-- tingkat "kesalahan"-nya beda arah:
--   - 017 (seller nggak deliver sama sekali) -- makin cepat dieskalasi makin
--     baik buat buyer, karena TIDAK ADA bukti kerjaan apa pun yang bisa
--     dinilai. Uang buyer beneran berisiko nyangkut tanpa hasil.
--   - 018 (buyer nggak confirm, TAPI deliverable sudah ada) -- ini paling
--     sering cuma soal buyer lupa/sibuk, bukan sengketa kualitas kerjaan.
--     Auto-complete di sini justru "berat sebelah" nguntungin seller (dia
--     yang nunggu haknya dibayar), jadi wajar dikasih window lebih panjang
--     supaya buyer yang GENUINE keberatan sama hasil kerjanya (bukan cuma
--     lupa klik) masih sempat menahannya secara manual sebelum ke-auto-
--     complete -- lihat "KETERBATASAN" di bawah soal gimana caranya.
-- Dihitung dari `delivered_at` (015) -- bukan `locked_at` -- karena jam
-- mulainya yang adil adalah begitu seller BENERAN submit hasil kerjaan,
-- bukan dari awal escrow di-lock (yang bisa saja seller-nya sendiri yang
-- lama ngerjain).
--
-- APA YANG BERUBAH DI ORDER
-- ---------------------------------------------------------------------------
-- `status -> 'completed'` + `completed_at` terisi (SAMA PERSIS efeknya
-- kayak buyer klik confirm manual lewat `confirm_order_complete` di 008/016)
-- + kolom baru `completion_reason` diisi biar kebaca ini auto bukan manual,
-- plus 1 pesan `order_update` di thread. TIDAK auto-release dana --
-- `mark_order_released` (008) TETAP manual-only selamanya, sesuai desain
-- awalnya (operator lewat SQL Editor) -- migrasi ini cuma mindahin status
-- 'locked' -> 'completed', sama seperti kalau buyer sendiri yang klik.
--
-- KETERBATASAN YANG MASIH ADA
-- ---------------------------------------------------------------------------
-- - Platform ini belum punya tombol "Dispute kualitas kerjaan" beneran di
--   UI (baru sebatas status 'disputed' penanda di 017 buat kasus non-
--   delivery). Kalau buyer GENUINE keberatan sama hasil kerjaan (bukan
--   cuma lupa confirm), satu-satunya cara mencegah auto-complete SEBELUM
--   jam ke-72 saat ini adalah minta operator turun tangan manual lewat SQL
--   Editor (mis. update status jadi 'disputed' duluan) -- belum ada
--   self-service buat buyer. Ini konsekuensi dari filosofi "trust-based/ala
--   kadarnya" yang sudah disebut di komentar 015, bukan bug baru.
-- - Sama seperti 013/017: fungsi ini BUKAN dipicu klik user, EXECUTE cuma
--   di-grant ke service_role, butuh scheduler (pg_cron kalau ada, atau
--   external cron via service role key) buat jalan otomatis.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom baru di `orders` -- alasan completion, biar bisa dibedain mana
--    yang buyer klik manual (tetap NULL, sama seperti sebelum migrasi ini)
--    vs mana yang ke-auto-complete karena buyer nggak kunjung confirm.
-- ----------------------------------------------------------------------------
alter table orders add column if not exists completion_reason text;

-- ----------------------------------------------------------------------------
-- 2. auto_complete_unconfirmed_orders()
--    Kandidat: status = 'locked', deliverable_url SUDAH terisi, delivered_at
--    sudah lebih dari 72 jam. Guard UPDATE sama polanya kayak 017/013 --
--    klaim baris dulu (status = 'locked' di WHERE), baru insert pesan --
--    nyegah race kalau buyer sempat confirm manual tepat di detik yang sama.
-- ----------------------------------------------------------------------------
create or replace function auto_complete_unconfirmed_orders()
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
      and deliverable_url is not null
      and delivered_at <= now() - interval '72 hours'
    order by delivered_at
  loop
    update orders
    set status = 'completed',
        completed_at = now(),
        completion_reason = 'buyer_no_confirm_72h'
    where id = v_order.id
      and status = 'locked'
      and deliverable_url is not null
    returning * into v_order;

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      continue; -- buyer sempat confirm manual / status berubah barusan, skip
    end if;

    insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
    values (
      v_order.provider_wallet, v_order.buyer_wallet,
      'Order automatically marked as complete — buyer did not confirm within 72 hours of delivery.',
      'order_update',
      jsonb_build_object('order_id', v_order.id, 'status', 'completed', 'completion_reason', 'buyer_no_confirm_72h')
    );

    v_count := v_count + 1;
  end loop;

  return v_count; -- jumlah order yang baru di-auto-complete, berguna buat log scheduler
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Hak akses + jadwal pg_cron -- sama persis pola 013/017.
-- ----------------------------------------------------------------------------
revoke all on function auto_complete_unconfirmed_orders() from public, anon, authenticated;
grant execute on function auto_complete_unconfirmed_orders() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'musyawarah_auto_complete_unconfirmed_orders') then
      perform cron.unschedule('musyawarah_auto_complete_unconfirmed_orders');
    end if;

    -- Tiap 15 menit -- cadence sama kayak dua fungsi periodik lain
    -- (musyawarah_send_escrow_confirmation_reminders,
    -- musyawarah_auto_dispute_non_delivery) biar gampang dibandingkan log-nya.
    perform cron.schedule(
      'musyawarah_auto_complete_unconfirmed_orders',
      '*/15 * * * *',
      'select auto_complete_unconfirmed_orders();'
    );
  end if;
end $$;
