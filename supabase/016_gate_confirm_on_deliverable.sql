-- MUSYAWARAH — 016: gate confirm_order_complete di belakang deliverable_url
-- ============================================================================
-- Jalankan SETELAH 015_order_deliverable.sql. Aman dijalankan berkali-kali
-- (idempotent).
--
-- Bug report: begitu buyer lock escrow (status -> 'locked'), tombol "Confirm
-- task complete" langsung aktif WALAUPUN provider belum submit deliverable
-- link sama sekali (015) -- buyer bisa asal klik confirm sebelum ada
-- kerjaan yang keliatan. UI kemarin cuma "encourage" (nampilin kartu link
-- kalau ada), gak "enforce" -- makanya bug ini bisa kejadian meskipun
-- form Mark as delivered udah ada.
--
-- Fix: confirm_order_complete() SEKARANG WAJIB order.deliverable_url udah
-- keisi (provider harus mark_order_delivered dulu) sebelum buyer bisa
-- confirm. Ini beda dari filosofi awal 015 (yang sengaja gak ngeblok) --
-- setelah dipikir ulang, order tanpa deliverable_url berarti belum ada
-- bukti kerjaan sama sekali, jadi "Confirm task complete" harusnya emang gak
-- boleh aktif dulu.
-- ============================================================================

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
  if v_order.deliverable_url is null then
    raise exception 'the provider has not submitted a deliverable link yet';
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

grant execute on function confirm_order_complete(uuid, text) to anon, authenticated;
