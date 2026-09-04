-- ============================================================================
-- ROLLBACK: wallet_auth_hardening.sql + fix_wallet_nonce_search_path.sql
--
-- Generated mechanically from the hardening migration:
--  1. Re-creates every patched RPC with the `perform assert_wallet_owner(...)`
--     guard line removed (restores pre-hardening behavior).
--  2. Re-grants `anon` execute on every RPC that had it revoked.
--  3. Drops the sign-in objects added by the hardening migration:
--     assert_wallet_owner(), consume_wallet_nonce(), request_wallet_nonce(),
--     auth_nonces table.
--
-- WARNING: after this runs, every RPC below is anon-callable again with NO
-- cryptographic check that the caller actually owns the wallet passed in
-- p_wallet/p_sender/p_from/etc. This is the exact impersonation hole the
-- hardening migration closed. Only run this if that tradeoff is intentional.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Restore RPCs to their pre-hardening bodies
-- ----------------------------------------------------------------------------

create or replace function create_post(
  p_wallet text,
  p_content text,
  p_image_url text default null,
  p_is_listing boolean default false,
  p_listing_title text default null,
  p_listing_category text default null,
  p_listing_price_amount numeric default null,
  p_listing_price_mode text default null,
  p_listing_coin_symbol text default 'UCT'
)
returns posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_cfg tier_config%rowtype;
  v_used int;
  v_content text := trim(coalesce(p_content, ''));
  v_listing_title text := trim(coalesce(p_listing_title, ''));
  v_listing_category text := trim(coalesce(p_listing_category, ''));
  v_post posts;
  v_streak_len int;
begin
  if p_wallet is null or length(p_wallet) = 0 then
    raise exception 'wallet is required';
  end if;


  if p_is_listing then
    if v_listing_title = '' then
      raise exception 'listing title is required';
    end if;
    if length(v_listing_title) > 80 then
      raise exception 'listing title exceeds 80 characters';
    end if;
    if v_listing_category = '' then
      raise exception 'listing category is required';
    end if;
    if p_listing_price_mode is null or p_listing_price_mode not in ('task', 'subscription') then
      raise exception 'listing price mode must be task or subscription';
    end if;
    if p_listing_price_amount is null or p_listing_price_amount <= 0 then
      raise exception 'listing price must be a positive number';
    end if;
  end if;

  if v_content = '' and p_image_url is null then
    raise exception 'post cannot be empty';
  end if;

  v_tier := active_tier(p_wallet);
  select * into v_cfg from tier_config where tier = v_tier;

  if length(v_content) > v_cfg.max_post_chars then
    raise exception 'content exceeds % character limit for tier %', v_cfg.max_post_chars, v_tier;
  end if;

  if p_image_url is not null and not v_cfg.can_attach_image then
    raise exception 'tier % cannot attach images', v_tier;
  end if;

  if v_cfg.daily_post_limit is not null then
    select count(*) into v_used
    from posts
    where author_wallet = p_wallet
      and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';

    if v_used >= v_cfg.daily_post_limit then
      raise exception 'daily post quota (%) reached for tier %', v_cfg.daily_post_limit, v_tier;
    end if;
  end if;

  insert into profiles (wallet_address) values (p_wallet)
  on conflict (wallet_address) do nothing;

  insert into posts (
    author_wallet, content, image_url,
    is_listing, listing_title, listing_category,
    listing_price_amount, listing_price_mode, listing_coin_symbol
  ) values (
    p_wallet, v_content, p_image_url,
    p_is_listing, nullif(v_listing_title, ''), nullif(v_listing_category, ''),
    p_listing_price_amount, p_listing_price_mode, p_listing_coin_symbol
  )
  returning * into v_post;

  perform award_quest(p_wallet, 'first_post');
  if p_image_url is not null then
    perform award_quest(p_wallet, 'post_with_image');
  end if;

  return v_post;
end;
$$;

create or replace function edit_post(p_wallet text, p_post_id uuid, p_content text)
returns posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_cfg tier_config%rowtype;
  v_content text := trim(coalesce(p_content, ''));
  v_post posts;
begin

  v_tier := active_tier(p_wallet);
  select * into v_cfg from tier_config where tier = v_tier;

  if not v_cfg.can_edit_post then
    raise exception 'tier % cannot edit posts', v_tier;
  end if;

  if v_content = '' then
    raise exception 'content cannot be empty';
  end if;

  if length(v_content) > v_cfg.max_post_chars then
    raise exception 'content exceeds % character limit for tier %', v_cfg.max_post_chars, v_tier;
  end if;

  update posts
  set content = v_content, edited_at = now()
  where id = p_post_id and author_wallet = p_wallet
  returning * into v_post;

  if v_post.id is null then
    raise exception 'post not found or not owned by this wallet';
  end if;

  perform award_quest(p_wallet, 'first_edit');

  return v_post;
end;
$$;

create or replace function delete_post(p_wallet text, p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  delete from posts where id = p_post_id and author_wallet = p_wallet;
  if not found then
    raise exception 'post not found or not owned by this wallet';
  end if;
end;
$$;

create or replace function toggle_follow(p_follower text, p_followed text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_following boolean;
  v_following_count int;
begin
  if p_follower is null or p_followed is null or length(p_follower) = 0 or length(p_followed) = 0 then
    raise exception 'both wallets are required';
  end if;


  if p_follower = p_followed then
    raise exception 'cannot follow yourself';
  end if;

  if exists (select 1 from follows where follower_wallet = p_follower and followed_wallet = p_followed) then
    delete from follows where follower_wallet = p_follower and followed_wallet = p_followed;
    delete from notifications
      where recipient_wallet = p_followed and actor_wallet = p_follower and type = 'follow';
    v_now_following := false;
  else
    insert into profiles (wallet_address) values (p_follower) on conflict do nothing;
    insert into follows (follower_wallet, followed_wallet) values (p_follower, p_followed);
    insert into notifications (recipient_wallet, actor_wallet, type)
      values (p_followed, p_follower, 'follow');
    v_now_following := true;

    select count(*) into v_following_count from follows where follower_wallet = p_follower;
    if v_following_count >= 3 then
      perform award_quest(p_follower, 'follow_3');
    end if;
  end if;

  return v_now_following;
end;
$$;

create or replace function toggle_repost(p_wallet text, p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author text;
  v_now_reposted boolean;
begin

  select author_wallet into v_author from posts where id = p_post_id;
  if v_author is null then
    raise exception 'post not found';
  end if;
  if v_author = p_wallet then
    raise exception 'cannot repost your own post';
  end if;

  if exists (select 1 from reposts where post_id = p_post_id and wallet_address = p_wallet) then
    delete from reposts where post_id = p_post_id and wallet_address = p_wallet;
    delete from notifications
      where actor_wallet = p_wallet and post_id = p_post_id and type = 'repost';
    v_now_reposted := false;
  else
    insert into reposts (post_id, wallet_address) values (p_post_id, p_wallet);
    insert into notifications (recipient_wallet, actor_wallet, type, post_id)
      values (v_author, p_wallet, 'repost', p_post_id);
    v_now_reposted := true;
  end if;

  return v_now_reposted;
end;
$$;

create or replace function toggle_like(p_wallet text, p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author text;
  v_now_liked boolean;
begin
  if p_wallet is null or length(p_wallet) = 0 then
    raise exception 'wallet is required';
  end if;


  select author_wallet into v_author from posts where id = p_post_id;
  if v_author is null then
    raise exception 'post not found';
  end if;

  if exists (select 1 from likes where post_id = p_post_id and wallet_address = p_wallet) then
    delete from likes where post_id = p_post_id and wallet_address = p_wallet;
    delete from notifications
      where actor_wallet = p_wallet and post_id = p_post_id and type = 'like';
    v_now_liked := false;
  else
    insert into profiles (wallet_address) values (p_wallet) on conflict do nothing;
    insert into likes (post_id, wallet_address) values (p_post_id, p_wallet);
    if v_author <> p_wallet then
      insert into notifications (recipient_wallet, actor_wallet, type, post_id)
        values (v_author, p_wallet, 'like', p_post_id);
    end if;
    v_now_liked := true;
  end if;

  return v_now_liked;
end;
$$;

create or replace function send_message(
  p_sender text,
  p_receiver text,
  p_content text default null,
  p_kind text default 'text',
  p_payload jsonb default null
)
returns messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content text := trim(coalesce(p_content, ''));
  v_post posts%rowtype;
  v_post_id uuid;
  v_message messages;
begin
  if p_sender is null or p_receiver is null or length(p_sender) = 0 or length(p_receiver) = 0 then
    raise exception 'both wallets are required';
  end if;


  if p_sender = p_receiver then
    raise exception 'cannot message yourself';
  end if;
  if p_kind not in ('text', 'listing_ref') then
    raise exception 'send_message only supports kind text or listing_ref (use propose_offer/accept_offer/decline_offer for offers)';
  end if;

  if p_kind = 'listing_ref' then
    v_post_id := (p_payload ->> 'post_id')::uuid;
    if v_post_id is null then
      raise exception 'payload.post_id is required for kind listing_ref';
    end if;

    select * into v_post from posts where id = v_post_id and is_listing;
    if v_post.id is null then
      raise exception 'listing not found';
    end if;

    if v_post.author_wallet <> p_sender and v_post.author_wallet <> p_receiver then
      raise exception 'this listing does not belong to either participant of this conversation';
    end if;

    if v_content = '' then
      v_content := format('Shared a listing: %s', v_post.listing_title);
    end if;
  else
    if v_content = '' then
      raise exception 'message content cannot be empty';
    end if;
  end if;

  if length(v_content) > 1000 then
    raise exception 'message exceeds 1000 characters';
  end if;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    p_sender, p_receiver, v_content, p_kind,
    case when p_kind = 'listing_ref' then jsonb_build_object('post_id', v_post_id) else null end
  )
  returning * into v_message;

  return v_message;
end;
$$;

create or replace function send_tip(
  p_from text, p_to text, p_post_id uuid, p_amount numeric, p_tx_hash text default null
)
returns tips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_author text;
  v_tip tips;
  v_received_count int;
begin
  if p_from is null or p_to is null then
    raise exception 'wallets are required';
  end if;


  if p_from = p_to then
    raise exception 'cannot tip your own post';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be greater than 0';
  end if;

  select author_wallet into v_post_author from posts where id = p_post_id;
  if v_post_author is null then
    raise exception 'post not found';
  end if;
  if v_post_author <> p_to then
    raise exception 'to_wallet does not match the post author';
  end if;

  insert into tips (post_id, from_wallet, to_wallet, amount, tx_hash)
  values (p_post_id, p_from, p_to, p_amount, p_tx_hash)
  returning * into v_tip;

  insert into notifications (recipient_wallet, actor_wallet, type, post_id, amount)
  values (p_to, p_from, 'tip', p_post_id, p_amount);

  perform award_quest(p_from, 'first_tip_sent');

  select count(*) into v_received_count from tips where to_wallet = p_to;
  if v_received_count >= 10 then
    perform award_quest(p_to, 'receive_10_tips');
  end if;

  return v_tip;
end;
$$;

create or replace function purchase_verification(
  p_wallet text, p_tier text, p_billing text, p_amount numeric, p_tx_hash text default null
)
returns verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg tier_config%rowtype;
  v_expected numeric;
  v_expires timestamptz;
  v_row verifications;
begin
  if p_wallet is null or length(trim(p_wallet)) = 0 then
    raise exception 'wallet is required';
  end if;


  if p_tier not in ('verified', 'verified_pro', 'verified_max') then
    raise exception 'invalid tier: %', p_tier;
  end if;
  if p_billing not in ('monthly', 'yearly') then
    raise exception 'invalid billing interval: %', p_billing;
  end if;

  select * into v_cfg from tier_config where tier = p_tier;

  v_expected := case
    when p_billing = 'yearly' then round(v_cfg.monthly_price_uct * 12 * (1 - v_cfg.annual_discount))
    else v_cfg.monthly_price_uct
  end;

  if p_amount is distinct from v_expected then
    raise exception 'amount % does not match expected price % for tier % (%)',
      p_amount, v_expected, p_tier, p_billing;
  end if;

  v_expires := case
    when p_billing = 'yearly' then now() + interval '1 year'
    else now() + interval '1 month'
  end;

  insert into profiles (wallet_address) values (p_wallet) on conflict do nothing;

  insert into verifications (wallet_address, tier, amount_paid, billing_interval, expires_at, tx_hash, updated_at)
  values (p_wallet, p_tier, p_amount, p_billing, v_expires, p_tx_hash, now())
  on conflict (wallet_address) do update set
    tier = excluded.tier,
    amount_paid = excluded.amount_paid,
    billing_interval = excluded.billing_interval,
    expires_at = excluded.expires_at,
    tx_hash = excluded.tx_hash,
    updated_at = now()
  returning * into v_row;

  if p_tier = 'verified_max' then
    perform award_quest(p_wallet, 'verified_max');
  end if;

  return v_row;
end;
$$;

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

create or replace function decline_offer(
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
  v_updated messages;
begin

  select * into v_offer from messages where id = p_message_id and kind = 'offer';
  if v_offer.id is null then
    raise exception 'offer not found';
  end if;
  if v_offer.payload ->> 'status' <> 'pending' then
    raise exception 'this offer has already been %', v_offer.payload ->> 'status';
  end if;
  if p_caller_wallet is null or p_caller_wallet <> v_offer.receiver_wallet then
    raise exception 'only the recipient of this offer can decline it';
  end if;

  update messages
  set payload = payload || jsonb_build_object('status', 'declined')
  where id = p_message_id
  returning * into v_updated;

  return v_updated;
end;
$$;

create or replace function mark_thread_read(
  p_wallet text,
  p_other_wallet text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  update messages
  set read = true
  where receiver_wallet = p_wallet
    and sender_wallet = p_other_wallet
    and read = false;
end;
$$;

create or replace function delete_message(
  p_message_id uuid,
  p_caller_wallet text
)
returns messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message messages%rowtype;
begin
  if p_caller_wallet is null or length(trim(p_caller_wallet)) = 0 then
    raise exception 'wallet is required';
  end if;


  select * into v_message from messages where id = p_message_id;
  if v_message.id is null then
    raise exception 'message not found';
  end if;
  if v_message.kind <> 'text' then
    raise exception 'only text messages can be deleted';
  end if;
  if v_message.sender_wallet <> p_caller_wallet then
    raise exception 'only the sender can delete their own message';
  end if;

  if v_message.deleted then
    return v_message;
  end if;

  update messages
  set content = '', deleted = true
  where id = p_message_id
  returning * into v_message;

  return v_message;
end;
$$;

create or replace function begin_escrow_lock(
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
begin
  if p_buyer_wallet is null or length(trim(p_buyer_wallet)) = 0 then
    raise exception 'buyer wallet is required';
  end if;


  update orders
  set status = 'locking',
      locking_at = now()
  where id = p_order_id
    and buyer_wallet = p_buyer_wallet
    and status = 'pending'
  returning * into v_order;

  if v_order.id is null then
    select * into v_order from orders where id = p_order_id;
    if v_order.id is null then
      raise exception 'order not found';
    end if;
    if v_order.buyer_wallet <> p_buyer_wallet then
      raise exception 'only the buyer on this order can lock escrow';
    end if;
    raise exception 'order is not pending (current status: %)', v_order.status;
  end if;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    v_order.buyer_wallet, v_order.provider_wallet,
    'Buyer is locking escrow — sending payment on-chain now.',
    'order_update',
    jsonb_build_object('order_id', v_order.id, 'status', 'locking')
  );

  return v_order;
end;
$$;

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

  update orders
  set escrow_wallet = v_treasury_wallet,
      lock_tx_hash = p_lock_tx_hash,
      status = 'locked',
      locked_at = now()
  where id = p_order_id
    and buyer_wallet = p_buyer_wallet
    and status = 'locking'
  returning * into v_order;

  if v_order.id is null then
    select * into v_order from orders where id = p_order_id;
    if v_order.id is null then
      raise exception 'order not found';
    end if;
    if v_order.buyer_wallet <> p_buyer_wallet then
      raise exception 'only the buyer on this order can lock escrow';
    end if;
    raise exception 'order is not in a locking state (current status: %) — the reservation may have expired. Your transaction hash (save this for support): %', v_order.status, p_lock_tx_hash;
  end if;

  v_buyer := v_order.buyer_wallet;
  v_provider := v_order.provider_wallet;

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

create or replace function abort_escrow_lock(
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
begin
  if p_buyer_wallet is null or length(trim(p_buyer_wallet)) = 0 then
    raise exception 'buyer wallet is required';
  end if;


  update orders
  set status = 'pending',
      locking_at = null
  where id = p_order_id
    and buyer_wallet = p_buyer_wallet
    and status = 'locking'
  returning * into v_order;

  if v_order.id is null then
    select * into v_order from orders where id = p_order_id;
    if v_order.id is null then
      raise exception 'order not found';
    end if;
    if v_order.buyer_wallet <> p_buyer_wallet then
      raise exception 'only the buyer on this order can abort a lock attempt';
    end if;
    raise exception 'order is not in a locking state (current status: %)', v_order.status;
  end if;

  insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
  values (
    v_order.buyer_wallet, v_order.provider_wallet,
    'Escrow lock attempt cancelled — order is pending again.',
    'order_update',
    jsonb_build_object('order_id', v_order.id, 'status', 'pending')
  );

  return v_order;
end;
$$;

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


  update orders
  set status = 'cancelled', cancelled_at = now()
  where id = p_order_id
    and (buyer_wallet = p_wallet or provider_wallet = p_wallet)
    and status = 'pending'
  returning * into v_order;

  if v_order.id is null then
    select * into v_order from orders where id = p_order_id;
    if v_order.id is null then
      raise exception 'order not found';
    end if;
    if p_wallet <> v_order.buyer_wallet and p_wallet <> v_order.provider_wallet then
      raise exception 'only the buyer or provider on this order can cancel it';
    end if;
    raise exception 'only pending orders can be cancelled (current status: %)', v_order.status;
  end if;

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
  if v_url !~* '^https?://' then
    raise exception 'deliverable url must start with http:// or https://';
  end if;

  update orders
  set deliverable_url = v_url,
      delivered_at = now()
  where id = p_order_id
    and provider_wallet = p_provider_wallet
    and status = 'locked'
    and deliverable_url is null
  returning * into v_order;

  if v_order.id is null then
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
    raise exception 'this order already has a deliverable link';
  end if;

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


  update orders
  set status = 'completed',
      completed_at = now()
  where id = p_order_id
    and buyer_wallet = p_buyer_wallet
    and status = 'locked'
    and deliverable_url is not null
  returning * into v_order;

  if v_order.id is null then
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
    raise exception 'the provider has not submitted a deliverable link yet';
  end if;

  v_buyer := v_order.buyer_wallet;
  v_provider := v_order.provider_wallet;

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

  update orders
  set status = 'disputed',
      disputed_at = now(),
      dispute_reason = 'buyer_quality_dispute',
      dispute_note = v_reason,
      dispute_used = true
  where id = p_order_id
    and buyer_wallet = p_buyer_wallet
    and status = 'locked'
    and deliverable_url is not null
    and dispute_used = false
  returning * into v_order;

  if v_order.id is null then
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
    raise exception 'this order has already used its one dispute — please confirm or leave a review instead';
  end if;

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

  update orders
  set deliverable_url = v_url,
      delivered_at = now(),
      status = 'locked',
      disputed_at = null,
      dispute_reason = null,
      dispute_note = null
  where id = p_order_id
    and provider_wallet = p_provider_wallet
    and status = 'disputed'
  returning * into v_order;

  if v_order.id is null then
    select * into v_order from orders where id = p_order_id;
    if v_order.id is null then
      raise exception 'order not found';
    end if;
    if v_order.provider_wallet <> p_provider_wallet then
      raise exception 'only the provider on this order can submit a revision';
    end if;
    raise exception 'order is not disputed (current status: %)', v_order.status;
  end if;

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
    raise exception 'order has not been flagged refund-eligible yet — wait for the 24h window after the dispute, or let auto_flag_refund_eligible_disputes() run';
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

create or replace function set_listing_active(
  p_wallet text,
  p_post_id uuid,
  p_active boolean
)
returns posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post posts;
begin

  select * into v_post from posts where id = p_post_id;
  if v_post.id is null then
    raise exception 'post not found';
  end if;
  if v_post.author_wallet <> p_wallet then
    raise exception 'only the listing owner can change its active status';
  end if;
  if not v_post.is_listing then
    raise exception 'post is not a listing';
  end if;

  update posts set listing_active = p_active where id = p_post_id
  returning * into v_post;

  return v_post;
end;
$$;

create or replace function submit_review(
  p_order_id uuid,
  p_reviewer_wallet text,
  p_rating int,
  p_comment text default null
)
returns reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_reviewee text;
  v_review reviews;
begin
  if p_reviewer_wallet is null or length(trim(p_reviewer_wallet)) = 0 then
    raise exception 'reviewer wallet is required';
  end if;


  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if v_order.status not in ('completed', 'released') then
    raise exception 'order must be completed or released before it can be reviewed (current status: %)', v_order.status;
  end if;

  if p_reviewer_wallet = v_order.buyer_wallet then
    v_reviewee := v_order.provider_wallet;
  elsif p_reviewer_wallet = v_order.provider_wallet then
    v_reviewee := v_order.buyer_wallet;
  else
    raise exception 'only the buyer or provider on this order can leave a review';
  end if;

  if exists (
    select 1 from reviews where order_id = p_order_id and reviewer_wallet = p_reviewer_wallet
  ) then
    raise exception 'you already reviewed this order';
  end if;

  insert into reviews (order_id, reviewer_wallet, reviewee_wallet, rating, comment)
  values (p_order_id, p_reviewer_wallet, v_reviewee, p_rating, nullif(trim(coalesce(p_comment, '')), ''))
  returning * into v_review;

  return v_review;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Re-grant anon on every RPC that had it revoked
-- ----------------------------------------------------------------------------

grant execute on function create_post(text, text, text, boolean, text, text, numeric, text, text) to anon;
grant execute on function edit_post(text, uuid, text) to anon;
grant execute on function delete_post(text, uuid) to anon;
grant execute on function toggle_follow(text, text) to anon;
grant execute on function toggle_repost(text, uuid) to anon;
grant execute on function toggle_like(text, uuid) to anon;
grant execute on function send_message(text, text, text, text, jsonb) to anon;
grant execute on function send_tip(text, text, uuid, numeric, text) to anon;
grant execute on function purchase_verification(text, text, text, numeric, text) to anon;
grant execute on function propose_offer(text, text, uuid, numeric, text) to anon;
grant execute on function accept_offer(uuid, text) to anon;
grant execute on function decline_offer(uuid, text) to anon;
grant execute on function mark_thread_read(text, text) to anon;
grant execute on function delete_message(uuid, text) to anon;
grant execute on function begin_escrow_lock(uuid, text) to anon;
grant execute on function lock_escrow_order(uuid, text, text) to anon;
grant execute on function abort_escrow_lock(uuid, text) to anon;
grant execute on function cancel_order(uuid, text) to anon;
grant execute on function mark_order_delivered(uuid, text, text) to anon;
grant execute on function confirm_order_complete(uuid, text) to anon;
grant execute on function dispute_order(uuid, text, text) to anon;
grant execute on function submit_deliverable_revision(uuid, text, text) to anon;
grant execute on function mark_order_released(uuid, text, text) to anon;
grant execute on function mark_order_refunded(uuid, text, text) to anon;
grant execute on function set_listing_active(text, uuid, boolean) to anon;
grant execute on function submit_review(uuid, text, int, text) to anon;

-- ----------------------------------------------------------------------------
-- 3. Drop the sign-in objects (must come after the RPC bodies above no longer
--    call assert_wallet_owner, otherwise this fails with a dependency error)
-- ----------------------------------------------------------------------------

drop function if exists assert_wallet_owner(text);
drop function if exists consume_wallet_nonce(text, text);
drop function if exists request_wallet_nonce(text);
drop table if exists auth_nonces;
