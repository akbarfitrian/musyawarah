-- ============================================================================
-- Migrasi: larang offer di listing milik sendiri (di chat manapun)
-- ============================================================================
-- Jalankan file ini sekali di Supabase SQL Editor.
--
-- Bug yang diperbaiki:
--   propose_offer() cuma ngecek listing itu punya SALAH SATU dari dua
--   partisipan chat:
--
--     if v_post.author_wallet <> p_sender and v_post.author_wallet <> p_receiver then
--       raise exception '...';
--     end if;
--
--   Ini berarti kalau SENDER kebetulan adalah pemilik listing itu sendiri
--   (misal listing_ref pernah ke-share di chat itu), sender bisa propose
--   offer buat listingnya sendiri ke lawan bicara.
--
--   Efek sampingnya kelihatan di accept_offer():
--     v_provider := v_post.author_wallet;               -- = sender (pemilik listing)
--     v_buyer := case when v_offer.sender_wallet = v_provider
--                  then v_offer.receiver_wallet          -- <-- lawan bicara jadi "buyer"
--                  else v_offer.sender_wallet end;
--
--   Jadi lawan bicara (yang sama sekali bukan pemilik listing & bukan yang
--   propose harga) didaulat jadi buyer: dia yang diminta "Accept" offer,
--   dan setelah accept, DIA yang harus lock escrow -- padahal listingnya
--   bukan dia yang jual dan harga bukan dia yang tawar.
--
-- Solusi:
--   Listing yang dijadikan objek offer WAJIB milik si PENERIMA pesan
--   (p_receiver), bukan salah satu dari sender/receiver. Ini memastikan
--   offer selalu: sender = calon buyer, receiver = pemilik listing/provider.
-- ============================================================================

create or replace function propose_offer(
  p_sender text,
  p_receiver text,
  p_post_id uuid,
  p_amount numeric,
  p_coin_symbol text default 'UCT'
)
returns messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post posts%rowtype;
  v_coin text := coalesce(nullif(trim(p_coin_symbol), ''), 'UCT');
  v_content text;
  v_message messages;
begin
  if p_sender is null or p_receiver is null or length(p_sender) = 0 or length(p_receiver) = 0 then
    raise exception 'both wallets are required';
  end if;
  if p_sender = p_receiver then
    raise exception 'cannot send an offer to yourself';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be greater than 0';
  end if;

  select * into v_post from posts where id = p_post_id and is_listing;
  if v_post.id is null then
    raise exception 'listing not found';
  end if;

  -- FIX: listingnya harus punya si PENERIMA offer, bukan sender.
  -- Sebelumnya: `v_post.author_wallet <> p_sender and v_post.author_wallet <> p_receiver`
  -- yang salah karena membolehkan sender menawar listing miliknya sendiri.
  if v_post.author_wallet <> p_receiver then
    raise exception 'you can only make an offer on a listing that belongs to the person you are messaging';
  end if;

  if not v_post.listing_active then
    raise exception 'this listing is no longer active and cannot receive new offers';
  end if;

  v_content := format('Offered %s %s for "%s"', p_amount, v_coin, v_post.listing_title);

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    p_sender, p_receiver, v_content, 'offer',
    jsonb_build_object(
      'post_id', p_post_id,
      'amount', p_amount,
      'coin_symbol', v_coin,
      'status', 'pending'
    )
  )
  returning * into v_message;

  return v_message;
end;
$$;
