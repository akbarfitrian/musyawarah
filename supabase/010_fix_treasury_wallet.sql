-- MUSYAWARAH — 010: fix treasury wallet constant di RPC escrow (Fase 3.1)
-- ============================================================================
-- Jalankan SETELAH 009_marketplace_reviews.sql. Aman dijalankan berkali-kali
-- (idempotent, cuma create-or-replace fungsi yang sudah ada).
--
-- BUG: di 008_marketplace_escrow_rpc.sql, v_treasury_wallet ke-isi string
-- salah -- literal nama variabel env-nya ikut ke-paste:
--   'VITE_VERIFICATION_TREASURY_WALLET=@masyarakat'
-- yang seharusnya cuma nilainya:
--   '@masyarakat'
-- Akibatnya mark_order_released() SELALU nolak wallet operator asli, jadi
-- order nggak pernah pindah dari 'completed' ke 'released', dan prompt
-- review di OrderUpdateChip.tsx nggak pernah muncul.
--
-- File ini create-or-replace ULANG lock_escrow_order() dan
-- mark_order_released() dengan constant yang sudah benar. confirm_order_
-- complete() nggak kepakai variabel ini jadi nggak perlu disentuh.
-- ============================================================================

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
  v_treasury_wallet constant text := '@masyarakat';
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
  v_treasury_wallet constant text := '@masyarakat';
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

grant execute on function lock_escrow_order(uuid, text, text) to anon, authenticated;
grant execute on function mark_order_released(uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Setelah run block di atas, buat "un-stuck"-in order yang sudah kebayar
-- manual tapi macet di status 'completed' (kasus di screenshot), jalanin
-- SATU BARIS ini sendiri, ganti '<order_id>' dengan id order yang beneran:
--
--   select mark_order_released('<order_id>', '@masyarakat');
--
-- ----------------------------------------------------------------------------
