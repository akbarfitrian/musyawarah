-- ============================================================================
-- Migrasi: wajibkan bukti transaksi on-chain saat release/refund escrow
-- ============================================================================
-- Jalankan file ini sekali di Supabase SQL Editor.
--
-- Masalah yang diperbaiki:
--   1) mark_order_released() dan mark_order_refunded() sebelumnya cuma
--      mengubah status di database -- tidak ada bukti bahwa dana beneran
--      dikirim ke penerima yang benar dengan jumlah yang benar.
--   2) Tidak ada proteksi terhadap tx hash yang dipakai ulang -- misal
--      operator tidak sengaja pakai transaksi yang sama untuk melunasi dua
--      order berbeda ke penerima & jumlah yang sama.
--
-- Solusi:
--   - Tambah kolom release_tx_hash & refund_tx_hash di orders.
--   - Unique index di kedua kolom itu (where not null) -- satu tx hash cuma
--     boleh dipakai untuk SATU order, walaupun penerima & jumlahnya sama
--     persis dengan order lain.
--   - mark_order_released/mark_order_refunded sekarang WAJIB terima tx hash,
--     dan menolak kalau tx hash itu sudah pernah dipakai buat order lain.
-- ============================================================================

alter table orders add column if not exists release_tx_hash text;
alter table orders add column if not exists refund_tx_hash text;

alter table orders drop constraint if exists orders_release_tx_hash_length;
alter table orders add constraint orders_release_tx_hash_length
  check (release_tx_hash is null or char_length(release_tx_hash) <= 200);

alter table orders drop constraint if exists orders_refund_tx_hash_length;
alter table orders add constraint orders_refund_tx_hash_length
  check (refund_tx_hash is null or char_length(refund_tx_hash) <= 200);

create unique index if not exists idx_orders_release_tx_hash_unique
  on orders (release_tx_hash) where release_tx_hash is not null;

create unique index if not exists idx_orders_refund_tx_hash_unique
  on orders (refund_tx_hash) where refund_tx_hash is not null;

-- Drop the old 2-arg signatures so callers can't accidentally bypass proof.
drop function if exists mark_order_released(uuid, text);
drop function if exists mark_order_refunded(uuid, text);

create or replace function mark_order_released(
  p_order_id uuid,
  p_operator_wallet text,
  p_release_tx_hash text
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_treasury_wallet constant text := '@masyarakat';
  v_order orders;
  v_buyer text;
  v_provider text;
begin
  if p_operator_wallet is null or p_operator_wallet <> v_treasury_wallet then
    raise exception 'only the treasury/operator wallet can release an order';
  end if;

  if p_release_tx_hash is null or length(trim(p_release_tx_hash)) = 0 then
    raise exception 'release_tx_hash is required -- send the payout to the provider on-chain first, then release with that transaction hash';
  end if;

  begin
    update orders
    set status = 'released',
        released_at = now(),
        release_tx_hash = p_release_tx_hash
    where id = p_order_id
      and status = 'completed'
    returning * into v_order;
  exception when unique_violation then
    raise exception 'this transaction hash has already been used to release a different order -- each payout needs its own unique on-chain transaction, even to the same recipient for the same amount';
  end;

  if v_order.id is null then
    select * into v_order from orders where id = p_order_id;
    if v_order.id is null then
      raise exception 'order not found';
    end if;
    raise exception 'order is not completed (current status: %)', v_order.status;
  end if;

  v_buyer := v_order.buyer_wallet;
  v_provider := v_order.provider_wallet;

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


create or replace function mark_order_refunded(
  p_order_id uuid,
  p_operator_wallet text,
  p_refund_tx_hash text
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_treasury_wallet constant text := '@masyarakat';
  v_order orders;
  v_buyer text;
  v_provider text;
begin
  if p_operator_wallet is null or p_operator_wallet <> v_treasury_wallet then
    raise exception 'only the treasury/operator wallet can refund an order';
  end if;

  if p_refund_tx_hash is null or length(trim(p_refund_tx_hash)) = 0 then
    raise exception 'refund_tx_hash is required -- send the refund to the buyer on-chain first, then confirm with that transaction hash';
  end if;

  begin
    update orders
    set status = 'refunded',
        refunded_at = now(),
        refund_tx_hash = p_refund_tx_hash
    where id = p_order_id
      and status = 'disputed'
      and refund_flagged_at is not null
    returning * into v_order;
  exception when unique_violation then
    raise exception 'this transaction hash has already been used to refund a different order -- each refund needs its own unique on-chain transaction, even to the same recipient for the same amount';
  end;

  if v_order.id is null then
    select * into v_order from orders where id = p_order_id;
    if v_order.id is null then
      raise exception 'order not found';
    end if;
    if v_order.status <> 'disputed' then
      raise exception 'order is not disputed (current status: %)', v_order.status;
    end if;
    raise exception 'order has not been flagged refund-eligible yet -- wait for the 24h window after the dispute, or let auto_flag_refund_eligible_disputes() run';
  end if;

  v_buyer := v_order.buyer_wallet;
  v_provider := v_order.provider_wallet;

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

grant execute on function mark_order_released(uuid, text, text) to anon, authenticated;
grant execute on function mark_order_refunded(uuid, text, text) to anon, authenticated;
