-- MUSYAWARAH — 009: marketplace Fase 4 (reviews + halaman Marketplace)
-- ============================================================================
-- Jalankan SETELAH 008_marketplace_escrow_rpc.sql. Aman dijalankan berkali-
-- kali (idempotent). Ref: musyawarah-marketplace-fase-3.2-dst.md, Fase 4.
--
-- Isi:
--   - Tabel `reviews` (draft ringkas §1d).
--   - RPC `submit_review(p_order_id, p_reviewer_wallet, p_rating, p_comment)`.
--   - RPC `get_provider_reputation(p_wallet)`.
--   - RPC `set_listing_active(p_wallet, p_post_id, p_active)` — dipakai
--     `MarketplacePage.tsx` sub-tab "My Listings". Draft menyebut RPC ini
--     "sudah ada sejak Fase 1", tapi belum pernah benar-benar ditulis di
--     migrasi manapun (006/007/008) — ditambahkan di sini karena Fase 4
--     butuh dia buat toggle aktif/nonaktif listing (posts.update sudah
--     dicabut haknya dari client sejak 002_harden_writes.sql).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabel `reviews` (draft ringkas §1d)
-- ----------------------------------------------------------------------------
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

alter table reviews enable row level security;

drop policy if exists "public read reviews" on reviews;
create policy "public read reviews" on reviews for select using (true);

revoke insert, update, delete on reviews from anon, authenticated;
grant select on reviews to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. submit_review() — validasi: order harus completed/released, caller
--    harus buyer_wallet atau provider_wallet di order itu, satu review per
--    (order_id, reviewer_wallet) (constraint unique di atas, di sini cuma
--    ditangkep jadi pesan error yang jelas).
-- ----------------------------------------------------------------------------
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

grant execute on function submit_review(uuid, text, int, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. get_provider_reputation() — rata-rata rating + jumlah review buat 1
--    wallet (dipakai kartu listing & ProfilePage).
-- ----------------------------------------------------------------------------
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

grant execute on function get_provider_reputation(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. set_listing_active() — provider tutup/buka listing tanpa hapus post.
--    Lihat catatan di header file ini soal kenapa ini baru ditulis sekarang.
-- ----------------------------------------------------------------------------
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

grant execute on function set_listing_active(text, uuid, boolean) to anon, authenticated;
