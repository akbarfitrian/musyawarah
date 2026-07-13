-- MUSYAWARAH — 012: blokir tawaran baru buat listing yang udah di-nonaktifin
-- ============================================================================
-- Jalankan file ini SETELAH 011_cancel_and_supersede_orders.sql, di Supabase
-- Dashboard -> SQL Editor. Aman dijalankan berkali-kali (idempotent).
--
-- BUG YANG DIPERBAIKI
-- --------------------
-- `propose_offer()` (007) sebelumnya cuma ngecek listing-nya ADA (`is_listing`)
-- dan ngecek pengirim/penerima salah satunya provider-nya -- gak pernah
-- ngecek `listing_active`. Akibatnya provider yang nonaktifin listing dari
-- profilnya (`set_listing_active`, 009) TETAP bisa nerima tawaran baru lewat
-- DM yang udah kebuka duluan (kartu listing_ref/offer lama masih nempel di
-- riwayat chat), padahal listingnya udah nggak nongol lagi di profil/
-- marketplace. Fix di klien (MessagesPage.tsx, lihat useProviderListings)
-- nyembunyiin tombol "Make offer"-nya, tapi itu doang bisa dilewatin siapa
-- aja yang manggil RPC ini langsung -- makanya validasinya ditambahin di
-- sini juga.
--
-- CATATAN: order yang UDAH ADA (accept_offer/lock_escrow/dst) TETAP jalan
-- normal walau listingnya belakangan di-nonaktifin -- ini cuma nutup jalan
-- buat TAWARAN BARU, bukan mutusin transaksi yang lagi berlangsung.
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
  if v_post.author_wallet <> p_sender and v_post.author_wallet <> p_receiver then
    raise exception 'this listing does not belong to either participant of this conversation';
  end if;
  -- Baris baru (012): listing yang udah di-nonaktifin providernya gak boleh
  -- nerima tawaran baru lagi, walaupun kartunya masih nongol di riwayat chat.
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

grant execute on function propose_offer(text, text, uuid, numeric, text) to anon, authenticated;
