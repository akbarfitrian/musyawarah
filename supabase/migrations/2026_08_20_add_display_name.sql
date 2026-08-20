-- ============================================================================
-- Migrasi: fitur Nama (display name)
-- ============================================================================
-- Jalankan file ini sekali di Supabase SQL Editor.
--
-- Nambahin kolom `name` di tabel `profiles` buat nama tampilan (display
-- name), terpisah dari handle. Handle (@username) TETAP diambil dari
-- wallet_address seperti sekarang — kolom `username` yang lama nggak
-- dipakai lagi buat itu, jadi nggak perlu diubah/dihapus, cukup dibiarkan.
-- ============================================================================

alter table profiles add column if not exists name text;
alter table profiles add column if not exists name_updated_at timestamptz;

alter table profiles drop constraint if exists profiles_name_check;
alter table profiles add constraint profiles_name_check check (char_length(name) <= 50);

-- ---- cooldown 30 hari buat ganti nama ----
-- Ngisi nama pertama kali (dari null) boleh kapan aja. Setelah itu, ganti
-- nama cuma boleh sekali per 30 hari sejak perubahan terakhir. Ditegakkan
-- di level database (trigger) supaya nggak bisa dilewatin cuma dengan
-- manggil Supabase client langsung, terlepas dari validasi di UI.
create or replace function profiles_enforce_name_cooldown()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.name is not null then
      NEW.name_updated_at := now();
    end if;
    return NEW;
  end if;

  if NEW.name is distinct from OLD.name then
    if OLD.name is not null and OLD.name_updated_at is not null
       and now() - OLD.name_updated_at < interval '30 days' then
      raise exception 'name_cooldown_active' using errcode = 'P0001';
    end if;
    NEW.name_updated_at := now();
  else
    NEW.name_updated_at := OLD.name_updated_at;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_profiles_name_cooldown on profiles;
create trigger trg_profiles_name_cooldown
  before insert or update on profiles
  for each row execute function profiles_enforce_name_cooldown();

-- ---- update fungsi leaderboard biar ikut nampilin `name` ----
-- (drop dulu karena return type berubah, `create or replace` doang nggak cukup)
drop function if exists get_top_tipped(text, int);
create function get_top_tipped(p_period text default 'all_time', p_limit int default 5)
returns table (
  wallet_address text,
  username text,
  name text,
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
    p.name,
    p.avatar_url,
    active_tier(t.to_wallet) as verification_tier,
    sum(t.amount) as total_amount
  from tips t
  left join profiles p on p.wallet_address = t.to_wallet
  where p_period = 'all_time' or t.created_at >= date_trunc('week', now() at time zone 'utc')
  group by t.to_wallet, p.username, p.name, p.avatar_url
  order by total_amount desc
  limit greatest(p_limit, 1)
$$;

grant execute on function get_top_tipped(text, int) to anon, authenticated;

drop function if exists get_top_tipped_posts(text, int);
create function get_top_tipped_posts(p_period text default 'all_time', p_limit int default 3)
returns table (
  post_id uuid,
  content text,
  author_wallet text,
  username text,
  name text,
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
    prof.name,
    prof.avatar_url,
    active_tier(p.author_wallet) as verification_tier,
    sum(t.amount) as total_amount
  from tips t
  join posts p on p.id = t.post_id
  left join profiles prof on prof.wallet_address = p.author_wallet
  where p_period = 'all_time' or t.created_at >= date_trunc('week', now() at time zone 'utc')
  group by p.id, p.content, p.author_wallet, prof.username, prof.name, prof.avatar_url
  order by total_amount desc
  limit greatest(p_limit, 1)
$$;

grant execute on function get_top_tipped_posts(text, int) to anon, authenticated;
