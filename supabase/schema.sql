create extension if not exists "pgcrypto";

-- ============================================================================
-- SECTION 1: TABLES
-- ============================================================================

-- ---- profiles ----
create table if not exists profiles (
  wallet_address text primary key,
  username text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

alter table profiles drop constraint if exists profiles_bio_check;
alter table profiles add constraint profiles_bio_check check (char_length(bio) <= 160);

-- ---- tier_config (reference table for post/verification tiers) ----
create table if not exists tier_config (
  tier text primary key check (tier in ('none', 'verified', 'verified_pro', 'verified_max')),
  daily_post_limit int,
  max_post_chars int not null,
  can_attach_image boolean not null,
  can_edit_post boolean not null,
  monthly_price_uct numeric not null,
  annual_discount numeric not null default 0.15
);

insert into tier_config (tier, daily_post_limit, max_post_chars, can_attach_image, can_edit_post, monthly_price_uct)
values
  ('none', 1, 60, false, false, 0),
  ('verified', 2, 150, false, false, 30),
  ('verified_pro', 2, 250, true, false, 50),
  ('verified_max', 3, 350, true, true, 100)
on conflict (tier) do update set
  daily_post_limit = excluded.daily_post_limit,
  max_post_chars = excluded.max_post_chars,
  can_attach_image = excluded.can_attach_image,
  can_edit_post = excluded.can_edit_post,
  monthly_price_uct = excluded.monthly_price_uct,
  annual_discount = excluded.annual_discount;

-- ---- posts (includes marketplace "listing" fields) ----
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_wallet text not null references profiles(wallet_address) on delete cascade,
  content text not null,
  image_url text,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  is_listing boolean not null default false,
  listing_title text,
  listing_category text,
  listing_price_amount numeric,
  listing_price_mode text,
  listing_coin_symbol text default 'UCT',
  listing_active boolean not null default true
);

alter table posts drop constraint if exists posts_content_check;
alter table posts add constraint posts_content_check check (char_length(content) <= 350);

alter table posts drop constraint if exists listing_price_mode_check;
alter table posts add constraint listing_price_mode_check
  check (listing_price_mode is null or listing_price_mode in ('task', 'subscription'));

alter table posts drop constraint if exists listing_fields_consistent;
alter table posts add constraint listing_fields_consistent check (
  not is_listing or (
    listing_title is not null and listing_category is not null and
    listing_price_amount is not null and listing_price_mode is not null
  )
);

create index if not exists idx_posts_created_at on posts (created_at desc);
create index if not exists idx_posts_is_listing on posts (is_listing) where is_listing;

-- ---- tips ----
create table if not exists tips (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  from_wallet text not null,
  to_wallet text not null,
  amount numeric not null check (amount > 0),
  tx_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_tips_post_id on tips (post_id);
create unique index if not exists idx_tips_tx_hash_unique on tips (tx_hash) where tx_hash is not null;

-- ---- reposts ----
create table if not exists reposts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  wallet_address text not null,
  created_at timestamptz not null default now(),
  unique (post_id, wallet_address)
);

create index if not exists idx_reposts_post_id on reposts (post_id);
create index if not exists idx_reposts_wallet on reposts (wallet_address);

-- ---- messages (DMs + listing refs + marketplace offers + order updates) ----
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_wallet text not null,
  receiver_wallet text not null,
  content text not null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  kind text not null default 'text',
  payload jsonb,
  deleted boolean not null default false
);

alter table messages drop constraint if exists messages_content_check;
alter table messages add constraint messages_content_check check (char_length(content) <= 1000);

alter table messages drop constraint if exists messages_kind_check;
alter table messages add constraint messages_kind_check
  check (kind in ('text', 'listing_ref', 'offer', 'order_update'));

create index if not exists idx_messages_sender on messages (sender_wallet, created_at desc);
create index if not exists idx_messages_receiver on messages (receiver_wallet, created_at desc);
create index if not exists idx_messages_kind on messages (kind) where kind <> 'text';

-- ---- follows ----
create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  follower_wallet text not null,
  followed_wallet text not null,
  created_at timestamptz not null default now(),
  unique (follower_wallet, followed_wallet),
  check (follower_wallet <> followed_wallet)
);

create index if not exists idx_follows_follower on follows (follower_wallet);
create index if not exists idx_follows_followed on follows (followed_wallet);

-- ---- verifications ----
create table if not exists verifications (
  wallet_address text primary key references profiles(wallet_address) on delete cascade,
  tier text not null,
  amount_paid numeric not null default 0,
  billing_interval text not null default 'monthly',
  expires_at timestamptz,
  tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table verifications drop constraint if exists verifications_tier_check;
alter table verifications add constraint verifications_tier_check
  check (tier in ('verified', 'verified_pro', 'verified_max'));

alter table verifications drop constraint if exists verifications_billing_interval_check;
alter table verifications add constraint verifications_billing_interval_check
  check (billing_interval in ('monthly', 'yearly'));

create index if not exists idx_verifications_tier on verifications (tier);
create index if not exists idx_verifications_expires_at on verifications (expires_at);
create unique index if not exists idx_verifications_tx_hash_unique on verifications (tx_hash) where tx_hash is not null;

-- ---- quests ----
create table if not exists quests (
  id text primary key,
  order_index int not null unique,
  title text not null,
  description text not null,
  level text not null check (level in ('easy', 'medium', 'hard')),
  points int not null check (points > 0),
  unlock_after text references quests(id),
  verify_label text not null
);

insert into quests (id, order_index, title, description, level, points, unlock_after, verify_label)
values
  ('connect_wallet', 1, 'Connect Sphere Wallet', 'Connect your Sphere Wallet to Musyawarah.', 'easy', 1, null,
    'Server trigger on wallet connect (record_wallet_connect)'),
  ('complete_profile', 2, 'Complete Your Profile', 'Fill in your profile photo and bio.', 'easy', 1, 'connect_wallet',
    'Server trigger (Postgres trigger on the profiles table) once avatar_url and bio are both filled in'),
  ('first_post', 3, 'Send Your First Post', 'Send your first post.', 'easy', 1, 'complete_profile',
    'Server trigger inside create_post'),
  ('follow_3', 4, 'Follow 3 Users', 'Follow 3 other wallets.', 'easy', 1, 'first_post',
    'Server trigger inside toggle_follow (counts follows rows)'),
  ('first_tip_sent', 5, 'Send Your First Tip (UCT)', 'Send a UCT tip to someone else''s post.', 'easy', 1, 'follow_3',
    'On-chain action, recorded inside send_tip'),
  ('verified_max', 6, 'Upgrade to Verified Max', 'Upgrade your verification tier to Verified Max.', 'medium', 2, 'first_tip_sent',
    'On-chain action, recorded inside purchase_verification (tier = verified_max)'),
  ('post_with_image', 7, 'Post With an Image', 'Send a post with an image (requires a tier that allows image attachments).', 'easy', 1, 'verified_max',
    'Server trigger inside create_post when image_url is filled in'),
  ('first_edit', 8, 'Edit Your First Post', 'Edit one of your previously sent posts (requires Verified Max tier).', 'easy', 1, 'verified_max',
    'Server trigger inside edit_post'),
  ('streak_5_days', 9, 'Post 5 Days in a Row', 'Send at least 1 post per day, 5 days in a row (UTC).', 'medium', 2, 'first_post',
    'Server trigger, recalculated inside create_post (daily streak)'),
  ('receive_10_tips', 10, 'Receive 10 Tips From Others', 'Receive 10 tips (cumulative) from other wallets.', 'hard', 3, 'first_tip_sent',
    'On-chain action, counted inside send_tip (cumulative incoming tips)')
on conflict (id) do update set
  order_index = excluded.order_index,
  title = excluded.title,
  description = excluded.description,
  level = excluded.level,
  points = excluded.points,
  unlock_after = excluded.unlock_after,
  verify_label = excluded.verify_label;

-- ---- user_quest_progress ----
create table if not exists user_quest_progress (
  wallet_address text not null references profiles(wallet_address) on delete cascade,
  quest_id text not null references quests(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (wallet_address, quest_id)
);

create index if not exists idx_user_quest_progress_wallet on user_quest_progress (wallet_address);

-- ---- orders (marketplace escrow flow) ----
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete restrict,
  buyer_wallet text not null,
  provider_wallet text not null,
  amount numeric not null check (amount > 0),
  coin_symbol text not null default 'UCT',
  escrow_wallet text,
  lock_tx_hash text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  released_at timestamptz,
  cancelled_at timestamptz,
  last_reminder_at timestamptz,
  deliverable_url text,
  delivered_at timestamptz,
  disputed_at timestamptz,
  dispute_reason text,
  completion_reason text,
  dispute_note text,
  dispute_used boolean not null default false,
  refund_flagged_at timestamptz,
  refunded_at timestamptz,
  locking_at timestamptz,
  release_tx_hash text,
  refund_tx_hash text,
  check (buyer_wallet <> provider_wallet)
);

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

alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('pending', 'locking', 'locked', 'completed', 'released', 'disputed', 'cancelled', 'refunded'));

alter table orders drop constraint if exists orders_deliverable_url_length;
alter table orders add constraint orders_deliverable_url_length
  check (deliverable_url is null or char_length(deliverable_url) <= 500);

alter table orders drop constraint if exists orders_dispute_note_length;
alter table orders add constraint orders_dispute_note_length
  check (dispute_note is null or char_length(dispute_note) <= 1000);

create index if not exists orders_buyer_idx on orders (buyer_wallet);
create index if not exists orders_provider_idx on orders (provider_wallet);
create index if not exists orders_post_idx on orders (post_id);

-- ---- reviews ----
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  reviewer_wallet text not null,
  reviewee_wallet text not null,
  rating int not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (order_id, reviewer_wallet)
);

create index if not exists reviews_reviewee_idx on reviews (reviewee_wallet);

-- ---- notifications ----
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_wallet text not null,
  actor_wallet text not null,
  type text not null,
  post_id uuid references posts(id) on delete cascade,
  amount numeric,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  order_id uuid references orders (id) on delete cascade,
  body text
);

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('follow', 'repost', 'tip', 'order_reminder'));

alter table notifications drop constraint if exists notifications_payload_check;
alter table notifications add constraint notifications_payload_check
  check (
    (type = 'follow' and post_id is null and amount is null and order_id is null)
    or (type = 'repost' and post_id is not null and amount is null and order_id is null)
    or (type = 'tip' and post_id is not null and amount is not null and order_id is null)
    or (type = 'order_reminder' and order_id is not null and amount is not null and body is not null)
  );

create index if not exists idx_notifications_recipient on notifications (recipient_wallet, created_at desc);
create index if not exists idx_notifications_actor_lookup on notifications (recipient_wallet, actor_wallet, type, post_id);
create index if not exists idx_notifications_order on notifications (order_id) where order_id is not null;

-- ============================================================================
-- SECTION 2: ROW LEVEL SECURITY & POLICIES
-- ============================================================================
-- Model:
--   - profiles: users manage their own row directly (no server function needed).
--   - everything else: reads are public, but direct writes from anon/authenticated
--     are revoked — all writes go through security-definer RPC functions
--     (see SECTION 3), which enforce the real business rules.

alter table profiles enable row level security;
drop policy if exists "public read profiles" on profiles;
create policy "public read profiles" on profiles for select using (true);
drop policy if exists "public upsert profiles" on profiles;
create policy "public upsert profiles" on profiles for insert with check (true);
drop policy if exists "public update own profile" on profiles;
create policy "public update own profile" on profiles for update using (true);

alter table posts enable row level security;
drop policy if exists "public read posts" on posts;
create policy "public read posts" on posts for select using (true);
drop policy if exists "public insert posts" on posts;
drop policy if exists "public delete posts" on posts;
drop policy if exists "public update posts" on posts;

alter table tips enable row level security;
drop policy if exists "public read tips" on tips;
create policy "public read tips" on tips for select using (true);
drop policy if exists "public insert tips" on tips;

alter table reposts enable row level security;
drop policy if exists "public read reposts" on reposts;
create policy "public read reposts" on reposts for select using (true);
drop policy if exists "public insert reposts" on reposts;
drop policy if exists "public delete reposts" on reposts;

alter table messages enable row level security;
drop policy if exists "public read messages" on messages;
create policy "public read messages" on messages for select using (true);
drop policy if exists "public insert messages" on messages;
drop policy if exists "public update messages" on messages;

alter table follows enable row level security;
drop policy if exists "public read follows" on follows;
create policy "public read follows" on follows for select using (true);
drop policy if exists "public insert follows" on follows;
drop policy if exists "public delete follows" on follows;

alter table verifications enable row level security;
drop policy if exists "public read verifications" on verifications;
create policy "public read verifications" on verifications for select using (true);
drop policy if exists "public upsert verifications" on verifications;
drop policy if exists "public update verifications" on verifications;

alter table notifications enable row level security;
drop policy if exists "public read notifications" on notifications;
create policy "public read notifications" on notifications for select using (true);
drop policy if exists "public insert notifications" on notifications;
drop policy if exists "public update notifications" on notifications;
drop policy if exists "public delete notifications" on notifications;

alter table quests enable row level security;
drop policy if exists "public read quests" on quests;
create policy "public read quests" on quests for select using (true);

alter table user_quest_progress enable row level security;

alter table orders enable row level security;
drop policy if exists "public read orders" on orders;
create policy "public read orders" on orders for select using (true);

alter table reviews enable row level security;
drop policy if exists "public read reviews" on reviews;
create policy "public read reviews" on reviews for select using (true);

-- ============================================================================
-- SECTION 3: FUNCTIONS
-- ============================================================================

-- ---- 3.1 tier / quest helpers ----

create or replace function active_tier(p_wallet text)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select case when v.expires_at is not null and v.expires_at <= now() then 'none' else v.tier end
      from verifications v
      where v.wallet_address = p_wallet
    ),
    'none'
  )
$$;


create or replace function award_quest(p_wallet text, p_quest_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_wallet is null or length(p_wallet) = 0 then
    return;
  end if;

  insert into profiles (wallet_address) values (p_wallet) on conflict do nothing;

  insert into user_quest_progress (wallet_address, quest_id)
  values (p_wallet, p_quest_id)
  on conflict (wallet_address, quest_id) do nothing;
end;
$$;


create or replace function record_wallet_connect(p_wallet text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_wallet is null or length(p_wallet) = 0 then
    raise exception 'wallet is required';
  end if;

  insert into profiles (wallet_address) values (p_wallet) on conflict do nothing;
  perform award_quest(p_wallet, 'connect_wallet');
end;
$$;


create or replace function trg_check_profile_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(trim(coalesce(new.avatar_url, ''))) > 0
     and length(trim(coalesce(new.bio, ''))) > 0
  then
    perform award_quest(new.wallet_address, 'complete_profile');
  end if;
  return new;
end;
$$;


-- ---- 3.2 posts / social actions ----

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
  )
  values (
    p_wallet, v_content, p_image_url,
    p_is_listing,
    case when p_is_listing then v_listing_title else null end,
    case when p_is_listing then v_listing_category else null end,
    case when p_is_listing then p_listing_price_amount else null end,
    case when p_is_listing then p_listing_price_mode else null end,
    case when p_is_listing then coalesce(nullif(trim(p_listing_coin_symbol), ''), 'UCT') else null end
  )
  returning * into v_post;

  perform award_quest(p_wallet, 'first_post');

  if p_image_url is not null then
    perform award_quest(p_wallet, 'post_with_image');
  end if;

  select count(*) into v_streak_len
  from (
    select d, d - (row_number() over (order by d))::int as grp
    from (
      select distinct (created_at at time zone 'utc')::date as d
      from posts
      where author_wallet = p_wallet
    ) distinct_days
  ) grouped
  group by grp
  having max(d) = (now() at time zone 'utc')::date
  order by count(*) desc
  limit 1;

  if coalesce(v_streak_len, 0) >= 5 then
    perform award_quest(p_wallet, 'streak_5_days');
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


create or replace function get_quest_board(p_wallet text)
returns table (
  quest_id text,
  title text,
  description text,
  level text,
  points int,
  order_index int,
  unlock_after text,
  unlock_after_order int,
  verify_label text,
  completed boolean,
  completed_at timestamptz,
  unlocked boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id as quest_id,
    q.title,
    q.description,
    q.level,
    q.points,
    q.order_index,
    q.unlock_after,
    uq.order_index as unlock_after_order,
    q.verify_label,
    (up.wallet_address is not null) as completed,
    up.completed_at,
    (
      q.unlock_after is null
      or exists (
        select 1 from user_quest_progress dep
        where dep.wallet_address = coalesce(p_wallet, '')
          and dep.quest_id = q.unlock_after
      )
    ) as unlocked
  from quests q
  left join quests uq on uq.id = q.unlock_after
  left join user_quest_progress up
    on up.quest_id = q.id and up.wallet_address = coalesce(p_wallet, '')
  order by q.order_index;
$$;


create or replace function get_top_tipped(p_period text default 'all_time', p_limit int default 5)
returns table (
  wallet_address text,
  username text,
  avatar_url text,
  verification_tier text,
  total_amount numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.to_wallet as wallet_address,
    p.username,
    p.avatar_url,
    active_tier(t.to_wallet) as verification_tier,
    sum(t.amount) as total_amount
  from tips t
  left join profiles p on p.wallet_address = t.to_wallet
  where p_period = 'all_time' or t.created_at >= date_trunc('week', now() at time zone 'utc')
  group by t.to_wallet, p.username, p.avatar_url
  order by total_amount desc
  limit greatest(p_limit, 1)
$$;


create or replace function get_top_tipped_posts(p_period text default 'all_time', p_limit int default 3)
returns table (
  post_id uuid,
  content text,
  author_wallet text,
  username text,
  avatar_url text,
  verification_tier text,
  total_amount numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as post_id,
    p.content,
    p.author_wallet,
    prof.username,
    prof.avatar_url,
    active_tier(p.author_wallet) as verification_tier,
    sum(t.amount) as total_amount
  from tips t
  join posts p on p.id = t.post_id
  left join profiles prof on prof.wallet_address = p.author_wallet
  where p_period = 'all_time' or t.created_at >= date_trunc('week', now() at time zone 'utc')
  group by p.id, p.content, p.author_wallet, prof.username, prof.avatar_url
  order by total_amount desc
  limit greatest(p_limit, 1)
$$;


-- ---- 3.3 messaging / negotiation ----

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
language sql
security definer
set search_path = public
as $$
  update messages
  set read = true
  where receiver_wallet = p_wallet
    and sender_wallet = p_other_wallet
    and read = false;
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


-- ---- 3.4 marketplace escrow / order lifecycle ----

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


-- ---- 3.5 reviews ----

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


create or replace function get_provider_reputation(p_wallet text)
returns table (avg_rating numeric, review_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(avg(rating), 0)::numeric(3, 2), count(*)::bigint
  from reviews
  where reviewee_wallet = p_wallet;
$$;


-- ---- 3.6 background jobs (called by pg_cron, service_role only) ----

create or replace function auto_decline_expired_offers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer messages%rowtype;
  v_rows integer;
  v_count integer := 0;
begin
  for v_offer in
    select * from messages
    where kind = 'offer'
      and payload ->> 'status' = 'pending'
      and created_at < now() - interval '3 hours'
    order by created_at
  loop
    update messages
    set payload = payload || jsonb_build_object('status', 'declined', 'declined_reason', 'expired')
    where id = v_offer.id
      and payload ->> 'status' = 'pending';

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      continue;
    end if;

    insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
    values (
      v_offer.receiver_wallet, v_offer.sender_wallet,
      'Offer automatically declined — no response within 3 hours.',
      'order_update',
      jsonb_build_object('offer_id', v_offer.id, 'status', 'auto_declined')
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


create or replace function send_escrow_confirmation_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_post posts%rowtype;
  v_body text;
  v_rows integer;
  v_count integer := 0;
begin
  for v_order in
    select * from orders
    where status = 'locked'
      and locked_at <= now() - interval '1 hour'
      and locked_at >= now() - interval '24 hours'
      and (last_reminder_at is null or last_reminder_at <= now() - interval '6 hours')
    order by locked_at
  loop
    update orders
    set last_reminder_at = now()
    where id = v_order.id
      and status = 'locked'
      and (last_reminder_at is null or last_reminder_at <= now() - interval '6 hours')
    returning * into v_order;

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      continue;
    end if;

    select * into v_post from posts where id = v_order.post_id;

    v_body := format(
      'Reminder: order #%s for "%s" (%s %s) is still waiting for buyer confirmation. Buyer %s · Seller %s · Escrow locked %s UTC.',
      left(v_order.id::text, 8),
      coalesce(v_post.listing_title, 'this listing'),
      v_order.amount,
      v_order.coin_symbol,
      left(v_order.buyer_wallet, 6) || '…' || right(v_order.buyer_wallet, 4),
      left(v_order.provider_wallet, 6) || '…' || right(v_order.provider_wallet, 4),
      to_char(v_order.locked_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI')
    );

    insert into notifications (recipient_wallet, actor_wallet, type, post_id, amount, order_id, body)
    values (v_order.buyer_wallet, v_order.provider_wallet, 'order_reminder', v_order.post_id, v_order.amount, v_order.id, v_body);

    insert into notifications (recipient_wallet, actor_wallet, type, post_id, amount, order_id, body)
    values (v_order.provider_wallet, v_order.buyer_wallet, 'order_reminder', v_order.post_id, v_order.amount, v_order.id, v_body);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


create or replace function auto_dispute_non_delivery()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_rows integer;
  v_count integer := 0;
begin
  for v_order in
    select * from orders
    where status = 'locked'
      and deliverable_url is null
      and locked_at <= now() - interval '24 hours'
    order by locked_at
  loop
    update orders
    set status = 'disputed',
        disputed_at = now(),
        dispute_reason = 'seller_no_delivery_24h'
    where id = v_order.id
      and status = 'locked'
      and deliverable_url is null
    returning * into v_order;

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      continue;
    end if;

    insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
    values (
      v_order.buyer_wallet, v_order.provider_wallet,
      'Order automatically flagged for dispute — no deliverable submitted within 24 hours of escrow lock.',
      'order_update',
      jsonb_build_object('order_id', v_order.id, 'status', 'disputed', 'dispute_reason', 'seller_no_delivery_24h')
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


create or replace function auto_complete_unconfirmed_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_rows integer;
  v_count integer := 0;
begin
  for v_order in
    select * from orders
    where status = 'locked'
      and deliverable_url is not null
      and delivered_at <= now() - interval '72 hours'
    order by delivered_at
  loop
    update orders
    set status = 'completed',
        completed_at = now(),
        completion_reason = 'buyer_no_confirm_72h'
    where id = v_order.id
      and status = 'locked'
      and deliverable_url is not null
    returning * into v_order;

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      continue;
    end if;

    insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
    values (
      v_order.provider_wallet, v_order.buyer_wallet,
      'Order automatically marked as complete — buyer did not confirm within 72 hours of delivery.',
      'order_update',
      jsonb_build_object('order_id', v_order.id, 'status', 'completed', 'completion_reason', 'buyer_no_confirm_72h')
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


create or replace function auto_flag_refund_eligible_disputes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_rows integer;
  v_count integer := 0;
begin
  for v_order in
    select * from orders
    where status = 'disputed'
      and dispute_reason = 'seller_no_delivery_24h'
      and deliverable_url is null
      and refund_flagged_at is null
      and disputed_at <= now() - interval '24 hours'
    order by disputed_at
  loop
    update orders
    set refund_flagged_at = now()
    where id = v_order.id
      and status = 'disputed'
      and deliverable_url is null
      and refund_flagged_at is null
    returning * into v_order;

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      continue;
    end if;

    insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
    values (
      v_order.buyer_wallet, v_order.provider_wallet,
      'Order flagged for refund — no response to the non-delivery dispute within 24 hours. An operator will process the refund.',
      'order_update',
      jsonb_build_object('order_id', v_order.id, 'status', 'disputed', 'refund_flagged_at', v_order.refund_flagged_at)
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


create or replace function auto_revert_stale_escrow_locks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_rows integer;
  v_count integer := 0;
begin
  for v_order in
    select * from orders
    where status = 'locking'
      and locking_at <= now() - interval '15 minutes'
    order by locking_at
  loop
    update orders
    set status = 'pending',
        locking_at = null
    where id = v_order.id
      and status = 'locking'
    returning * into v_order;

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      continue;
    end if;

    insert into messages (sender_wallet, receiver_wallet, content, kind, payload)
    values (
      v_order.buyer_wallet, v_order.provider_wallet,
      'Escrow lock attempt expired after 15 minutes without confirmation — order is pending again.',
      'order_update',
      jsonb_build_object('order_id', v_order.id, 'status', 'pending')
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


-- ============================================================================
-- SECTION 4: TRIGGERS
-- ============================================================================

drop trigger if exists profiles_quest_check on profiles;
create trigger profiles_quest_check
  after insert or update on profiles
  for each row execute function trg_check_profile_complete();

-- ============================================================================
-- SECTION 5: GRANTS
-- ============================================================================

-- direct table access: read-only for anon/authenticated on RPC-only tables
revoke insert, update, delete on posts, tips, reposts, follows, verifications, notifications, messages, orders, reviews
  from anon, authenticated;

grant select on posts, tips, reposts, follows, verifications, notifications, messages, orders, reviews
  to anon, authenticated;

revoke insert, update, delete on quests, user_quest_progress from anon, authenticated;
revoke select on user_quest_progress from anon, authenticated;
grant select on quests to anon, authenticated;

-- function execute grants
grant execute on function active_tier(text) to anon, authenticated;
grant execute on function award_quest(text, text) to anon, authenticated;
grant execute on function record_wallet_connect(text) to anon, authenticated;
grant execute on function create_post(text, text, text, boolean, text, text, numeric, text, text) to anon, authenticated;
grant execute on function edit_post(text, uuid, text) to anon, authenticated;
grant execute on function delete_post(text, uuid) to anon, authenticated;
grant execute on function toggle_follow(text, text) to anon, authenticated;
grant execute on function toggle_repost(text, uuid) to anon, authenticated;
grant execute on function send_tip(text, text, uuid, numeric, text) to anon, authenticated;
grant execute on function purchase_verification(text, text, text, numeric, text) to anon, authenticated;
grant execute on function get_quest_board(text) to anon, authenticated;
grant execute on function get_top_tipped(text, int) to anon, authenticated;
grant execute on function get_top_tipped_posts(text, int) to anon, authenticated;

grant execute on function send_message(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function propose_offer(text, text, uuid, numeric, text) to anon, authenticated;
grant execute on function accept_offer(uuid, text) to anon, authenticated;
grant execute on function decline_offer(uuid, text) to anon, authenticated;
grant execute on function mark_thread_read(text, text) to anon, authenticated;
grant execute on function delete_message(uuid, text) to anon, authenticated;

grant execute on function begin_escrow_lock(uuid, text) to anon, authenticated;
grant execute on function lock_escrow_order(uuid, text, text) to anon, authenticated;
grant execute on function abort_escrow_lock(uuid, text) to anon, authenticated;
grant execute on function cancel_order(uuid, text) to anon, authenticated;
grant execute on function mark_order_delivered(uuid, text, text) to anon, authenticated;
grant execute on function confirm_order_complete(uuid, text) to anon, authenticated;
grant execute on function dispute_order(uuid, text, text) to anon, authenticated;
grant execute on function submit_deliverable_revision(uuid, text, text) to anon, authenticated;
grant execute on function mark_order_released(uuid, text, text) to anon, authenticated;
grant execute on function mark_order_refunded(uuid, text, text) to anon, authenticated;
grant execute on function set_listing_active(text, uuid, boolean) to anon, authenticated;

grant execute on function submit_review(uuid, text, int, text) to anon, authenticated;
grant execute on function get_provider_reputation(text) to anon, authenticated;

-- background jobs: service_role only, never exposed to clients
revoke all on function auto_decline_expired_offers() from public, anon, authenticated;
revoke all on function send_escrow_confirmation_reminders() from public, anon, authenticated;
revoke all on function auto_dispute_non_delivery() from public, anon, authenticated;
revoke all on function auto_complete_unconfirmed_orders() from public, anon, authenticated;
revoke all on function auto_flag_refund_eligible_disputes() from public, anon, authenticated;
revoke all on function auto_revert_stale_escrow_locks() from public, anon, authenticated;

grant execute on function auto_decline_expired_offers() to service_role;
grant execute on function send_escrow_confirmation_reminders() to service_role;
grant execute on function auto_dispute_non_delivery() to service_role;
grant execute on function auto_complete_unconfirmed_orders() to service_role;
grant execute on function auto_flag_refund_eligible_disputes() to service_role;
grant execute on function auto_revert_stale_escrow_locks() to service_role;

-- ============================================================================
-- SECTION 6: SCHEDULED JOBS (pg_cron, only if the extension is installed)
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then

    if exists (select 1 from cron.job where jobname = 'musyawarah_auto_decline_expired_offers') then
      perform cron.unschedule('musyawarah_auto_decline_expired_offers');
    end if;
    if exists (select 1 from cron.job where jobname = 'musyawarah_send_escrow_confirmation_reminders') then
      perform cron.unschedule('musyawarah_send_escrow_confirmation_reminders');
    end if;
    if exists (select 1 from cron.job where jobname = 'musyawarah_auto_dispute_non_delivery') then
      perform cron.unschedule('musyawarah_auto_dispute_non_delivery');
    end if;
    if exists (select 1 from cron.job where jobname = 'musyawarah_auto_complete_unconfirmed_orders') then
      perform cron.unschedule('musyawarah_auto_complete_unconfirmed_orders');
    end if;
    if exists (select 1 from cron.job where jobname = 'musyawarah_auto_flag_refund_eligible_disputes') then
      perform cron.unschedule('musyawarah_auto_flag_refund_eligible_disputes');
    end if;
    if exists (select 1 from cron.job where jobname = 'musyawarah_auto_revert_stale_escrow_locks') then
      perform cron.unschedule('musyawarah_auto_revert_stale_escrow_locks');
    end if;

    perform cron.schedule('musyawarah_auto_decline_expired_offers', '*/5 * * * *',
      'select auto_decline_expired_offers();');
    perform cron.schedule('musyawarah_send_escrow_confirmation_reminders', '*/15 * * * *',
      'select send_escrow_confirmation_reminders();');
    perform cron.schedule('musyawarah_auto_dispute_non_delivery', '*/15 * * * *',
      'select auto_dispute_non_delivery();');
    perform cron.schedule('musyawarah_auto_complete_unconfirmed_orders', '*/15 * * * *',
      'select auto_complete_unconfirmed_orders();');
    perform cron.schedule('musyawarah_auto_flag_refund_eligible_disputes', '*/15 * * * *',
      'select auto_flag_refund_eligible_disputes();');
    perform cron.schedule('musyawarah_auto_revert_stale_escrow_locks', '*/5 * * * *',
      'select auto_revert_stale_escrow_locks();');
  end if;
end $$;

-- ============================================================================
-- SECTION 7: STORAGE (avatar uploads)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "public read avatars" on storage.objects;
create policy "public read avatars" on storage.objects
  for select using (bucket_id = 'avatars');
drop policy if exists "public upload avatars" on storage.objects;
create policy "public upload avatars" on storage.objects
  for insert with check (bucket_id = 'avatars');
drop policy if exists "public update avatars" on storage.objects;
create policy "public update avatars" on storage.objects
  for update using (bucket_id = 'avatars');
drop policy if exists "public delete avatars" on storage.objects;
create policy "public delete avatars" on storage.objects
  for delete using (bucket_id = 'avatars');
