# Cutover: identitas pubkey + guard wallet-login (testnet)

Urutan ini untuk project Supabase yang SUDAH berjalan dengan skema lama
(RPC terbuka untuk `anon`). Jangan diacak.

## 0. Prasyarat (sebelum menyentuh production)

- [ ] Edge function `wallet-login` ter-deploy, secret `WALLET_JWT_SECRET` terisi
      (Dashboard -> Project Settings -> API -> JWT Secret).
- [ ] Project masih menerima token HS256 dari legacy JWT secret. Kalau project
      memakai signing key asimetris dan secret lama dinonaktifkan, token dari
      `wallet-login` ditolak dan SEMUA request (termasuk baca) bisa gagal 401.
- [ ] Tes di preview deployment dengan wallet asli: connect -> tanda tangan ->
      posting berhasil. Cek juga `sendTip` (lihat catatan "tip" di bawah).
- [ ] Domain produksi sudah ada di `app_allowed_login_domains`
      (`*.vercel.app` otomatis diizinkan oleh fungsi).
- [ ] `VITE_VERIFICATION_TREASURY_WALLET` di Vercel = pubkey hex treasury.

## 1. Jalankan di SQL Editor, satu per satu, berurutan

1. `supabase/reset/2026_10_18_reset_testnet_data.sql`   (menghapus data user)
2. `supabase/schema.sql`                                (idempotent; memuat app_config)
3. `supabase/migrations/2026_08_24_wallet_auth_hardening.sql`
4. `supabase/migrations/2026_08_25_siwe_style_nonce.sql`
5. `supabase/migrations/2026_08_25_fix_wallet_nonce_search_path.sql`
6. `supabase/migrations/2026_10_18_app_config_treasury.sql`  (aman diulang)
7. Isi treasury:
   ```sql
   update app_config set value = '<pubkey hex 66 karakter, huruf kecil>'
   where key = 'treasury_wallet';
   ```
8. Tambah domain produksi:
   ```sql
   insert into app_allowed_login_domains (domain) values ('domain-kamu.com')
   on conflict do nothing;
   ```

Setelah langkah 3, RPC tulis TIDAK bisa dipanggil `anon` lagi. Klien lama
(sebelum patch fase 1) akan gagal menulis, jadi deploy klien baru segera
setelah langkah 1-8 selesai.

## 2. Deploy klien (Vercel)

Klien baru: login signature (fase 1) + `identityToHandle` memakai pubkey.

## 3. Verifikasi setelah cutover

Dari konsol browser / REST dengan anon key SAJA, ini HARUS gagal:

```js
await supabase.rpc('create_post', { p_wallet: '<pubkey siapa pun>', p_content: 'x' })
// -> error "unauthenticated: no verified wallet session" (atau permission denied)
```

Dan dari aplikasi, dengan wallet yang login: posting/like/follow/kirim pesan
harus berhasil. Query bagian [2] di `fase0-cek-data.sql` harus menunjukkan
`anon_boleh = false` untuk semua RPC tulis.

## Catatan

- **Tip / bukti pembayaran:** `findMatchingSentHistoryEntry` mencocokkan
  penerima dengan riwayat wallet. Sebelumnya penerima nametag dicocokkan lewat
  `recipientNametag`; sekarang penerima berupa pubkey. Tes satu tip + satu
  order escrow di preview dan pastikan `verified` bernilai true.
- **Tampilan nama:** alamat tampil sebagai `02b98c…83a976` bila profil belum
  punya `name`. Nametag Sphere sengaja tidak dipakai sebagai identitas.
