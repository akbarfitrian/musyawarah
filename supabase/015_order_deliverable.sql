-- MUSYAWARAH — 015: deliverable link buat order (Fase 3.5)
-- ============================================================================
-- Jalankan SETELAH 014_delete_message.sql. Aman dijalankan berkali-kali
-- (idempotent).
--
-- Latar: sebelum ini, satu-satunya cara provider "ngirim" hasil kerjaan
-- adalah lewat chat DM biasa (teks bebas, gampang ke-scroll/ketutup pesan
-- lain), dan buyer klik "Confirm task complete" murni berdasar kepercayaan.
-- Migrasi ini nambahin 1 field eksplisit di order itu sendiri buat provider
-- naruh LINK hasil kerjaan (Google Drive/GitHub/Figma/dst -- platform ini
-- sendiri gak punya file storage buat deliverable, jadi bentuknya link, bukan
-- upload) SEBELUM buyer confirm, biar keliatan jelas & gak nyampur ke chat.
--
-- Isi:
--   1. Kolom baru `orders.deliverable_url` + `orders.delivered_at`.
--   2. RPC baru `mark_order_delivered(p_order_id, p_provider_wallet,
--      p_deliverable_url)` -- provider doang, cuma pas status masih 'locked',
--      cuma bisa dipanggil SEKALI per order (deliverable_url belum keisi).
--      Nembak chip baru `order_update` (status tetap 'locked', payload
--      nambah `deliverable_url`) biar OrderUpdateChip.tsx bisa nampilin
--      kartu link-nya di thread.
--   3. Sengaja TIDAK ngeblok `confirm_order_complete` (008) -- buyer tetap
--      boleh confirm kapan aja selama 'locked', dengan atau tanpa
--      deliverable_url keisi. Alasan sama kayak field lain di sini: platform
--      ini trust-based/"ala kadarnya", bukan gerbang wajib. UI cuma
--      nge-encourage lewat tampilan, bukan block di level RPC.
-- ============================================================================

alter table orders add column if not exists deliverable_url text;
alter table orders add column if not exists delivered_at timestamptz;

alter table orders drop constraint if exists orders_deliverable_url_length;
alter table orders add constraint orders_deliverable_url_length
  check (deliverable_url is null or char_length(deliverable_url) <= 500);

-- ----------------------------------------------------------------------------
-- mark_order_delivered()
-- ----------------------------------------------------------------------------
create or replace function mark_order_delivered(
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
  -- Validasi ala kadarnya -- cuma mastiin ini beneran link, bukan sembarang
  -- teks (biar gak kepake buat nulis "deliverable" bebas tanpa link asli).
  if v_url !~* '^https?://' then
    raise exception 'deliverable url must start with http:// or https://';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if v_order.provider_wallet <> p_provider_wallet then
    raise exception 'only the provider on this order can mark it as delivered';
  end if;
  if v_order.status <> 'locked' then
    raise exception 'order is not locked (current status: %)', v_order.status;
  end if;
  if v_order.deliverable_url is not null then
    raise exception 'this order already has a deliverable link';
  end if;

  update orders
  set deliverable_url = v_url,
      delivered_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    v_order.provider_wallet, v_order.buyer_wallet,
    'Provider marked this order as delivered.',
    'order_update',
    jsonb_build_object('order_id', v_order.id, 'status', 'locked', 'deliverable_url', v_url)
  );

  return v_order;
end;
$$;

grant execute on function mark_order_delivered(uuid, text, text) to anon, authenticated;
