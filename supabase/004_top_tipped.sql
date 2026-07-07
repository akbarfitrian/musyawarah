-- MUSYAWARAH — 004: top tipped leaderboard (weekly + all-time)
-- ============================================================================
-- Jalankan file ini SETELAH schema.sql, 002_harden_writes.sql, dan
-- 003_quests.sql, di Supabase Dashboard -> SQL Editor. Aman dijalankan
-- berkali-kali (idempotent).
--
-- Sebelumnya "Top tipped" di RightPanel.tsx cuma nge-rank POST yang lagi
-- ke-load di client berdasar tip_total-nya (bukan leaderboard user
-- sebenarnya). Migrasi ini nambah satu RPC, get_top_tipped(), yang
-- mengagregasi total tip yang DITERIMA tiap wallet langsung di server --
-- dua varian periode:
--   - 'weekly'   : akumulasi tip sejak Senin 00:00 UTC minggu berjalan
--                  (date_trunc('week', ...) di Postgres sudah mulai dari
--                  Senin, jadi cocok tanpa perlu hitung manual).
--   - 'all_time' : akumulasi dari awal, semua tip yang pernah tercatat.
-- ============================================================================

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

grant execute on function get_top_tipped(text, int) to anon, authenticated;
