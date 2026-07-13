-- MUSYAWARAH — 014: hapus pesan (delete_message)
-- ============================================================================
-- Jalankan SETELAH 013_offer_expiry_and_escrow_reminders.sql, di Supabase
-- Dashboard -> SQL Editor. Aman dijalankan berkali-kali (idempotent).
--
-- ISI
-- ----
-- - Kolom baru `messages.deleted boolean`.
-- - RPC baru `delete_message(p_message_id, p_caller_wallet)` — SOFT delete
--   (bukan `DELETE FROM messages`): content-nya dikosongin + `deleted = true`,
--   barisnya TETAP ADA di posisi yang sama di riwayat chat. Klien nampilin
--   placeholder "Message deleted" buat baris yang `deleted = true`, mirip
--   pola WhatsApp/Telegram — biar lawan bicara tetap tau ada pesan yang
--   sempat dikirim di situ (bukan tiba-tiba ngilang tanpa jejak, yang bisa
--   ngerusak alur baca percakapan), tapi ISI pesannya beneran nggak ada lagi
--   di DB (bukan cuma disembunyiin di klien).
--
-- KENAPA DIBATASIN CUMA kind = 'text'
-- ------------------------------------------------------------------------
-- `listing_ref` / `offer` / `order_update` itu bukan "chat biasa" — dia
-- histori transaksi (tawaran, status order, dst) yang dipakai buat nge-
-- render kartu offer/order (lihat `orderSnapshots`/`listingSnapshots` di
-- useMessages.ts, ATAU chip status di OrderUpdateChip.tsx) DAN jadi bukti
-- kalau ada dispute nantinya. Ngebolehin itu dihapus bisa bikin kartu
-- offer/order ilang dari satu sisi (padahal `orders`/`payload`-nya tetap ada
-- di DB, jadi datanya nyangkut/nggak konsisten), atau numpuk jadi jalan buat
-- ngilangin jejak sebelum dispute. Makanya RPC ini nolak selain kind='text'.
--
-- KENAPA CUMA PENGIRIM YANG BOLEH HAPUS (bukan penerima)
-- ------------------------------------------------------------------------
-- Sama kayak WhatsApp/Telegram/Discord — "hapus buat semua" cuma hak
-- pengirim pesannya sendiri. Penerima yang nggak mau lihat pesan tertentu
-- lagi itu kasus beda (client-side "hide for me", belum diminta di sini).
-- ============================================================================

alter table messages add column if not exists deleted boolean not null default false;

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
    return v_message; -- udah dihapus sebelumnya -- no-op, biar idempotent kalau diklik dobel
  end if;

  update messages
  set content = '', deleted = true
  where id = p_message_id
  returning * into v_message;

  return v_message;
end;
$$;

grant execute on function delete_message(uuid, text) to anon, authenticated;
