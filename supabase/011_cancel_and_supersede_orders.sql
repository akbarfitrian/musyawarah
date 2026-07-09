-- MUSYAWARAH — 011: cancel_order() + auto-supersede order pending lama
-- ============================================================================
-- Jalankan SETELAH 010_fix_treasury_wallet.sql. Aman dijalankan berkali-kali
-- (idempotent).
--
-- Isi:
--   1. Kolom baru `orders.cancelled_at` + status 'cancelled' ditambahin ke
--      check constraint.
--   2. RPC baru `cancel_order(p_order_id, p_wallet)` -- buyer ATAU provider
--      di order itu boleh cancel, TAPI cuma selama status masih 'pending'
--      (belum ada dana di escrow sama sekali). Begitu sudah 'locked', harus
--      lewat flow dispute manual (Fase 3.1 draft §8), bukan cancel sepihak.
--   3. accept_offer() di-create-or-replace: begitu offer baru di-accept buat
--      post + pasangan buyer/provider yang sama, order 'pending' LAMA yang
--      belum sempat di-lock otomatis di-supersede (jadi 'cancelled') --
--      biar thread nggak numpuk chip "Lock escrow" basi tiap kali harga
--      dinego ulang (ini akar masalah yang bikin 4 order nyasar sebelumnya).
-- ============================================================================

alter table orders add column if not exists cancelled_at timestamptz;

alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('pending', 'locked', 'completed', 'released', 'disputed', 'cancelled'));

-- ----------------------------------------------------------------------------
-- 1. cancel_order()
-- ----------------------------------------------------------------------------
create or replace function cancel_order(
  p_order_id uuid,
  p_wallet text
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
begin
  if p_wallet is null or length(trim(p_wallet)) = 0 then
    raise exception 'wallet is required';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if p_wallet <> v_order.buyer_wallet and p_wallet <> v_order.provider_wallet then
    raise exception 'only the buyer or provider on this order can cancel it';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'only pending orders can be cancelled (current status: %)', v_order.status;
  end if;

  update orders
  set status = 'cancelled', cancelled_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    p_wallet,
    case when p_wallet = v_order.buyer_wallet then v_order.provider_wallet else v_order.buyer_wallet end,
    'Order cancelled.',
    'order_update',
    jsonb_build_object('order_id', v_order.id, 'status', 'cancelled')
  );

  return v_order;
end;
$$;

grant execute on function cancel_order(uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. accept_offer() -- sama seperti 007, ditambah blok supersede sebelum
--    insert order baru.
-- ----------------------------------------------------------------------------
create or replace function accept_offer(
  p_message_id uuid,
  p_caller_wallet text
)
returns messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer messages%rowtype;
  v_post posts%rowtype;
  v_post_id uuid;
  v_amount numeric;
  v_coin text;
  v_buyer text;
  v_provider text;
  v_order orders;
  v_updated messages;
  v_superseded_id uuid;
begin
  select * into v_offer from messages where id = p_message_id and kind = 'offer';
  if v_offer.id is null then
    raise exception 'offer not found';
  end if;
  if v_offer.payload ->> 'status' <> 'pending' then
    raise exception 'this offer has already been % ', v_offer.payload ->> 'status';
  end if;
  if p_caller_wallet is null or p_caller_wallet <> v_offer.receiver_wallet then
    raise exception 'only the recipient of this offer can accept it';
  end if;

  v_post_id := (v_offer.payload ->> 'post_id')::uuid;
  v_amount := (v_offer.payload ->> 'amount')::numeric;
  v_coin := coalesce(v_offer.payload ->> 'coin_symbol', 'UCT');

  select * into v_post from posts where id = v_post_id;
  if v_post.id is null then
    raise exception 'listing no longer exists';
  end if;

  v_provider := v_post.author_wallet;
  v_buyer := case when v_offer.sender_wallet = v_provider then v_offer.receiver_wallet else v_offer.sender_wallet end;

  if v_buyer = v_provider then
    raise exception 'could not determine buyer for this offer';
  end if;

  -- Supersede order 'pending' lama buat pasangan post+buyer+provider yang
  -- sama (mis. hasil offer lebih rendah/tinggi yang ditinggal begitu aja pas
  -- nego lanjut) -- biar nggak numpuk selamanya nunggu di-lock yang gak akan
  -- pernah kejadian.
  for v_superseded_id in
    update orders
    set status = 'cancelled', cancelled_at = now()
    where post_id = v_post_id
      and buyer_wallet = v_buyer
      and provider_wallet = v_provider
      and status = 'pending'
    returning id
  loop
    insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
    values (
      v_provider, v_buyer,
      'This order was superseded by a new accepted offer.',
      'order_update',
      jsonb_build_object('order_id', v_superseded_id, 'status', 'cancelled')
    );
  end loop;

  insert into orders (post_id, buyer_wallet, provider_wallet, amount, coin_symbol, status)
  values (v_post_id, v_buyer, v_provider, v_amount, v_coin, 'pending')
  returning * into v_order;

  update messages
  set payload = payload || jsonb_build_object('status', 'accepted', 'order_id', v_order.id)
  where id = p_message_id
  returning * into v_updated;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    v_provider, v_buyer,
    format('Order created for %s %s — waiting for escrow lock.', v_amount, v_coin),
    'order_update',
    jsonb_build_object('order_id', v_order.id, 'status', 'pending')
  );

  return v_updated;
end;
$$;

grant execute on function accept_offer(uuid, text) to anon, authenticated;
