-- ============================================================================
-- Migrasi: fitur Like
-- ============================================================================
-- Jalankan file ini sekali di Supabase SQL Editor.
--
-- Nambahin:
--   - Tabel `likes`, sama polanya kayak `reposts` (satu wallet cuma bisa like
--     satu post sekali, unique constraint di (post_id, wallet_address)).
--   - RLS: read publik, write cuma lewat RPC (security definer) di bawah.
--   - Fungsi `toggle_like(p_wallet, p_post_id)` — toggle like/unlike, dan
--     kirim notifikasi ke pemilik post (kecuali like postingan sendiri).
--   - Tipe notifikasi baru 'like' di constraint `notifications_type_check`
--     dan `notifications_payload_check`.
--
-- Beda dari repost/tip: like ke post sendiri DIBOLEHIN (nggak ada exception
-- "cannot like your own post"), soalnya itu perilaku umum di aplikasi sosial
-- lain juga. Cuma notifikasinya yang di-skip biar nggak notif diri sendiri.
-- ============================================================================

-- ---- tabel ----
create table if not exists likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  wallet_address text not null,
  created_at timestamptz not null default now(),
  unique (post_id, wallet_address)
);

create index if not exists idx_likes_post_id on likes (post_id);
create index if not exists idx_likes_wallet on likes (wallet_address);

-- ---- RLS ----
alter table likes enable row level security;
drop policy if exists "public read likes" on likes;
create policy "public read likes" on likes for select using (true);
drop policy if exists "public insert likes" on likes;
drop policy if exists "public delete likes" on likes;

-- ---- izinin 'like' sebagai tipe notifikasi ----
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('follow', 'repost', 'like', 'tip', 'order_reminder'));

alter table notifications drop constraint if exists notifications_payload_check;
alter table notifications add constraint notifications_payload_check
  check (
    (type = 'follow' and post_id is null and amount is null and order_id is null)
    or (type = 'repost' and post_id is not null and amount is null and order_id is null)
    or (type = 'like' and post_id is not null and amount is null and order_id is null)
    or (type = 'tip' and post_id is not null and amount is not null and order_id is null)
    or (type = 'order_reminder' and order_id is not null and amount is not null and body is not null)
  );

-- ---- fungsi toggle ----
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

grant execute on function toggle_like(text, uuid) to anon, authenticated;
