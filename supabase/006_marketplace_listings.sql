-- MUSYAWARAH — 006: marketplace Fase 1 (listing sebagai varian post)
-- ============================================================================
-- Jalankan file ini SETELAH schema.sql, 002_harden_writes.sql, 003_quests.sql,
-- 004_top_tipped.sql, dan 005_top_tipped_posts.sql, di Supabase Dashboard ->
-- SQL Editor. Aman dijalankan berkali-kali (idempotent).
--
-- Ref: musyawarah-marketplace-draft.md §1a & §2 (baris create_post diperluas).
-- Fase 1 doang -- BELUM ada tabel `orders`/`reviews`, BELUM ada
-- messages.kind/payload, BELUM ada transaksi apa pun. Listing di sini murni
-- "post dengan metadata jualan nempel di atasnya", bisa muncul di feed,
-- tapi belum bisa di-nego/di-hire lewat sistem escrow.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom listing di `posts` (nullable, gak ganggu post biasa)
-- ----------------------------------------------------------------------------
alter table posts add column if not exists is_listing boolean not null default false;
alter table posts add column if not exists listing_title text;
alter table posts add column if not exists listing_category text;
alter table posts add column if not exists listing_price_amount numeric;
alter table posts add column if not exists listing_price_mode text;
alter table posts add column if not exists listing_coin_symbol text default 'UCT';
alter table posts add column if not exists listing_active boolean not null default true;

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

create index if not exists idx_posts_is_listing on posts (is_listing) where is_listing;

-- ----------------------------------------------------------------------------
-- 2. create_post() diperluas -- terima parameter listing, opsional (default
--    post biasa kalau gak diisi). Signature lama (p_wallet, p_content,
--    p_image_url) di-drop dulu biar gak ada dua overload yang bikin ambigu
--    pas dipanggil lewat supabase.rpc(...) pakai named args.
--
--    PENTING: 003_quests.sql sebelumnya udah nge-redefine create_post buat
--    nambahin award_quest('first_post')/('post_with_image') + hitung streak
--    harian ('streak_5_days'). Migrasi ini WAJIB bawa logic itu juga di
--    fungsi baru -- kalau nggak, quest-quest itu diam-diam berhenti kecatat
--    begitu migrasi ini jalan. Bagian quest di bawah disalin apa adanya dari
--    003_quests.sql, cuma ditambah insert kolom listing di tengahnya.
-- ----------------------------------------------------------------------------
drop function if exists create_post(text, text, text);

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

  -- Validasi field listing DI SERVER (bukan cuma di client) -- sama alasannya
  -- kayak validasi tier/kuota di bawah: siapa aja yang tau anon key bisa
  -- manggil rpc ini langsung lewat DevTools.
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

  -- `content` listing dipakai sebagai deskripsi skill, tetep tunduk ke batas
  -- karakter tier yang sama kayak post biasa (lihat draft §1a -- opsi (i):
  -- gak ada aturan panjang teks yang beda-beda buat listing).
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

  -- === quest awards, dibawa apa adanya dari 003_quests.sql ===
  perform award_quest(p_wallet, 'first_post');

  if p_image_url is not null then
    perform award_quest(p_wallet, 'post_with_image');
  end if;

  -- Streak harian (UTC): kelompokkan tanggal post distinct pakai trik
  -- "tanggal minus row_number()" -- baris yang tanggalnya berurutan bakal
  -- punya grup (d - row_number) yang sama. Ambil grup yang tanggal
  -- terakhirnya = hari ini, panjangnya = streak yang sedang berjalan.
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

grant execute on function create_post(text, text, text, boolean, text, text, numeric, text, text) to anon, authenticated;
