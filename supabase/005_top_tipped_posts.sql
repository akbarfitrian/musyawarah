-- MUSYAWARAH — 005: top tipped posts ("Trending")
-- ============================================================================
-- Jalankan file ini SETELAH 004_top_tipped.sql, di Supabase Dashboard -> SQL
-- Editor. Aman dijalankan berkali-kali (idempotent).
--
-- Melengkapi get_top_tipped() (leaderboard USER) di 004_top_tipped.sql --
-- migrasi ini nambah satu RPC lagi, get_top_tipped_posts(), yang
-- mengagregasi total tip per POST (bukan per wallet penerima). Dipakai di
-- sub-tab "Trending" pada card Top Tipped di RightPanel.tsx.
--
-- Periode sama persis dengan get_top_tipped(): 'weekly' (sejak Senin 00:00
-- UTC minggu berjalan) atau 'all_time'.
--
-- Post yang sudah dihapus otomatis nggak ikut muncul -- pakai `join posts`
-- (bukan `left join`), dan baris tips-nya sendiri sudah ikut kehapus lewat
-- `on delete cascade` di kolom tips.post_id (lihat schema.sql), jadi tidak
-- perlu filter tambahan.
-- ============================================================================

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

grant execute on function get_top_tipped_posts(text, int) to anon, authenticated;
