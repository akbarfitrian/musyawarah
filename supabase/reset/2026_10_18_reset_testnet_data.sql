-- ============================================================================
-- RESET DATA TESTNET — DESTRUCTIVE, TIDAK BISA DIBATALKAN
--
-- Menghapus SEMUA data user (profil, post, pesan, order, tip, dst).
-- Hanya untuk fase testnet. JANGAN dijalankan setelah ada data nyata.
--
-- Yang TIDAK disentuh (data seed/konfigurasi):
--   quests, tier_config, app_config, app_allowed_login_domains
--
-- Yang TIDAK dihapus di sini: file di Storage (bucket avatars/gambar post).
-- Kosongkan lewat Dashboard -> Storage kalau mau (jangan DELETE langsung ke
-- storage.objects dari SQL, filenya tetap tertinggal di object storage).
--
-- Urutan lengkap cutover: lihat supabase/CUTOVER.md
-- ============================================================================

truncate table
  notifications,
  reviews,
  orders,
  user_quest_progress,
  verifications,
  follows,
  messages,
  likes,
  reposts,
  tips,
  posts,
  profiles
restart identity cascade;

-- auth_nonces baru ada setelah migrasi 2026_08_24 dijalankan.
do $$
begin
  if to_regclass('public.auth_nonces') is not null then
    execute 'truncate table auth_nonces';
  end if;
end
$$;
