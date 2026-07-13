-- MUSYAWARAH — 019: dispute kualitas kerjaan (buyer) + revisi deliverable (seller)
-- ============================================================================
-- Jalankan SETELAH 018_auto_complete_unconfirmed_orders.sql. Aman dijalankan
-- berkali-kali (idempotent).
--
-- LATAR
-- -----
-- 017 & 018 nutup dua celah "diem-dieman" (seller nggak deliver / buyer
-- nggak confirm), tapi belum ada jalan buat buyer yang AKTIF keberatan sama
-- HASIL kerjaannya (bukan cuma lupa/diem). Sebelum migrasi ini, satu-
-- satunya cara mencegah order ke-auto-complete di jam ke-72 (018) adalah
-- minta operator turun tangan manual lewat SQL Editor -- migrasi ini bikin
-- itu self-service, sekaligus kasih seller jalan buat "membalas" dispute
-- dengan revisi, bukan cuma pasrah nunggu operator.
--
-- DUA RPC BARU, DUA-DUANYA dipicu klik user (BEDA dari 013/017/018 yang
-- semuanya periodic/scheduler-only) -- jadi keduanya di-grant ke
-- anon/authenticated seperti pola RPC user-triggered lain di project ini
-- (lock_escrow_order, confirm_order_complete, dst), BUKAN service_role.
--
--   1. `dispute_order(p_order_id, p_buyer_wallet, p_reason)`
--      Buyer, kapan saja selama status = 'locked' DAN deliverable_url sudah
--      ada (order tanpa deliverable_url itu wilayah 017, bukan sini) --
--      TIDAK ada batas waktu 24/72 jam, buyer boleh dispute secepat setelah
--      seller submit deliverable, sesuai keputusan produk. `p_reason` WAJIB
--      diisi (bukan tombol kosong) -- disimpan di kolom baru `dispute_note`
--      biar operator yang nanti nyelesaiin tau alasannya tanpa scroll chat.
--      Efek: status -> 'disputed', dispute_reason = 'buyer_quality_dispute'
--      (beda dari dispute_reason 017 yang 'seller_no_delivery_24h' -- kolom
--      yang sama, tapi nilainya beda, biar operator langsung tau JENIS
--      dispute-nya dari 1 kolom tanpa perlu buka thread).
--
--   2. `submit_deliverable_revision(p_order_id, p_provider_wallet,
--       p_deliverable_url)`
--      Seller, HANYA selama status = 'disputed' (baik karena dispute
--      manual di atas, MAUPUN karena auto-dispute 017 -- dua-duanya boleh
--      dibalas revisi, karena toh keduanya sama-sama berarti "belum ada
--      hasil yang buyer terima/setujui"). BEDA dari `mark_order_delivered`
--      (015) yang cuma boleh dipanggil SEKALI selama deliverable_url masih
--      kosong -- fungsi ini justru KHUSUS buat nimpa deliverable_url yang
--      sudah ada (revisi), makanya dipisah jadi RPC sendiri, bukan
--      melonggarkan guard di 015 (015 tetap berlaku apa adanya buat
--      submission pertama).
--      Efek: deliverable_url ditimpa link baru, delivered_at = now() (jam
--      ke-72 di 018 RESTART dari titik ini -- adil, karena buyer belum
--      pernah menilai revisi ini), status -> 'locked' lagi, dispute_reason
--      & dispute_note & disputed_at di-NULL-kan (bukan dihapus riwayatnya --
--      riwayat tetap ada di message thread lewat chip `order_update`, kolom
--      di `orders` ini sengaja cuma nyimpen STATE TERKINI, bukan histori).
--
-- KENAPA GANTI DENGAN LOOP, BUKAN RESOLUSI FINAL
-- ---------------------------------------------------------------------------
-- Buyer & seller bisa saling dispute -> revisi -> dispute -> revisi tanpa
-- batas jumlah (nggak ada RPC yang ngeblok pengulangan). Ini SENGAJA
-- konsisten sama filosofi "trust-based/ala kadarnya" yang sudah disebut di
-- 015 -- platform ini nggak menghakimi SIAPA yang benar, cuma nyediain
-- mekanisme buat dua pihak saling merespons. Kalau macet beneran (salah
-- satu pihak berhenti merespons), itu balik ke jalur operator manual, sama
-- kayak keterbatasan yang sudah dicatat di 017/018.
--
-- REVISI KEPUTUSAN (LIHAT 020) -- bagian "loop tanpa batas" di atas TIDAK
-- JADI dipakai. Setelah dipikir ulang: rating/review (009) sudah ada buat
-- menghukum seller yang hasil kerjanya jelek, jadi dispute nggak perlu jadi
-- alat tawar-menawar berulang -- cukup SEKALI per order, biar operator
-- nggak perlu ikut campur buat kasus yang sebenarnya udah tercover sistem
-- rating. `submit_deliverable_revision()` di bawah TETAP ada apa adanya
-- (seller tetap boleh balas dispute dengan revisi), yang berubah cuma:
-- `dispute_order()` di-CREATE OR REPLACE di 020 buat nolak dispute KEDUA
-- pada order yang sama.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom baru di `orders` -- alasan dispute dalam kata-kata buyer sendiri.
-- ----------------------------------------------------------------------------
alter table orders add column if not exists dispute_note text;

alter table orders drop constraint if exists orders_dispute_note_length;
alter table orders add constraint orders_dispute_note_length
  check (dispute_note is null or char_length(dispute_note) <= 1000);

-- ----------------------------------------------------------------------------
-- 2. dispute_order()
-- ----------------------------------------------------------------------------
create or replace function dispute_order(
  p_order_id uuid,
  p_buyer_wallet text,
  p_reason text
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_reason text;
begin
  if p_buyer_wallet is null or length(trim(p_buyer_wallet)) = 0 then
    raise exception 'buyer wallet is required';
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  if length(v_reason) = 0 then
    raise exception 'a reason is required to dispute this order';
  end if;
  if length(v_reason) > 1000 then
    raise exception 'reason is too long (max 1000 characters)';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if v_order.buyer_wallet <> p_buyer_wallet then
    raise exception 'only the buyer on this order can dispute it';
  end if;
  if v_order.status <> 'locked' then
    raise exception 'order is not locked (current status: %)', v_order.status;
  end if;
  if v_order.deliverable_url is null then
    raise exception 'cannot dispute quality before the provider has submitted a deliverable';
  end if;

  update orders
  set status = 'disputed',
      disputed_at = now(),
      dispute_reason = 'buyer_quality_dispute',
      dispute_note = v_reason
  where id = p_order_id
  returning * into v_order;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    v_order.buyer_wallet, v_order.provider_wallet,
    'Buyer disputed the delivered work: ' || v_reason,
    'order_update',
    jsonb_build_object('order_id', v_order.id, 'status', 'disputed', 'dispute_reason', 'buyer_quality_dispute')
  );

  return v_order;
end;
$$;

grant execute on function dispute_order(uuid, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. submit_deliverable_revision()
-- ----------------------------------------------------------------------------
create or replace function submit_deliverable_revision(
  p_order_id uuid,
  p_provider_wallet text,
  p_deliverable_url text
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_url text;
begin
  if p_provider_wallet is null or length(trim(p_provider_wallet)) = 0 then
    raise exception 'provider wallet is required';
  end if;

  v_url := trim(coalesce(p_deliverable_url, ''));
  if length(v_url) = 0 then
    raise exception 'deliverable url is required';
  end if;
  if length(v_url) > 500 then
    raise exception 'deliverable url is too long (max 500 characters)';
  end if;
  if v_url !~* '^https?://' then
    raise exception 'deliverable url must start with http:// or https://';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if v_order.provider_wallet <> p_provider_wallet then
    raise exception 'only the provider on this order can submit a revision';
  end if;
  if v_order.status <> 'disputed' then
    raise exception 'order is not disputed (current status: %)', v_order.status;
  end if;

  update orders
  set deliverable_url = v_url,
      delivered_at = now(),
      status = 'locked',
      disputed_at = null,
      dispute_reason = null,
      dispute_note = null
  where id = p_order_id
  returning * into v_order;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    v_order.provider_wallet, v_order.buyer_wallet,
    'Provider submitted a revised deliverable in response to the dispute.',
    'order_update',
    jsonb_build_object('order_id', v_order.id, 'status', 'locked', 'deliverable_url', v_url)
  );

  return v_order;
end;
$$;

grant execute on function submit_deliverable_revision(uuid, text, text) to anon, authenticated;
