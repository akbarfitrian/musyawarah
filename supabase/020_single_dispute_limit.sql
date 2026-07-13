-- MUSYAWARAH — 020: batasi dispute jadi 1x per order
-- ============================================================================
-- Jalankan SETELAH 019_dispute_and_revision.sql. Aman dijalankan berkali-kali
-- (idempotent).
--
-- LATAR
-- -----
-- 019 sengaja dibikin bisa dispute -> revisi -> dispute -> revisi tanpa
-- batas. Keputusan produk berubah: dispute cukup SEKALI per order. Alasannya
-- -- rating/review (009) SUDAH ada buat menghukum seller yang hasil
-- kerjaannya jelek (rating rendah nempel permanen di profil dia), jadi
-- dispute nggak perlu jadi alat tawar-menawar berulang yang butuh operator
-- ikut mantau. Cukup 1 kesempatan buat buyer nyuruh seller revisi, abis itu
-- buyer tinggal confirm atau (kalau masih nggak puas) kasih rating jelek
-- setelah order selesai -- BUKAN dispute lagi.
--
-- KENAPA KOLOM BARU (bukan nge-reuse disputed_at/dispute_reason yang udah
-- ada)
-- ---------------------------------------------------------------------------
-- `disputed_at`/`dispute_reason`/`dispute_note` sengaja DI-NULL-KAN lagi
-- oleh `submit_deliverable_revision()` (019) begitu seller balas revisi --
-- itu levelnya "state SAAT INI" (null berarti "nggak lagi disputed
-- sekarang"). Kalau limit 1x dicek dari kolom itu, begitu di-null-kan,
-- buyer bisa dispute LAGI (balik ke perilaku 019 yang mau dihindari). Makanya
-- butuh flag TERPISAH yang TIDAK ikut di-null-kan oleh revisi -- sekali
-- `true`, permanen `true` selama order itu ada.
-- ============================================================================

alter table orders add column if not exists dispute_used boolean not null default false;

-- ----------------------------------------------------------------------------
-- dispute_order() -- create-or-replace, tambah 1 guard baru di paling atas
-- (setelah validasi dasar) dan set `dispute_used = true` bareng update
-- lainnya. Sisanya SAMA PERSIS dengan versi 019.
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
  -- Guard baru (020): dispute cuma boleh sekali seumur hidup order ini,
  -- terlepas dari berapa kali seller sudah submit revisi sejak itu.
  if v_order.dispute_used then
    raise exception 'this order has already used its one dispute — please confirm or leave a review instead';
  end if;

  update orders
  set status = 'disputed',
      disputed_at = now(),
      dispute_reason = 'buyer_quality_dispute',
      dispute_note = v_reason,
      dispute_used = true
  where id = p_order_id
  returning * into v_order;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    v_order.buyer_wallet, v_order.provider_wallet,
    'Buyer disputed the delivered work (one-time dispute used): ' || v_reason,
    'order_update',
    jsonb_build_object('order_id', v_order.id, 'status', 'disputed', 'dispute_reason', 'buyer_quality_dispute')
  );

  return v_order;
end;
$$;

grant execute on function dispute_order(uuid, text, text) to anon, authenticated;
