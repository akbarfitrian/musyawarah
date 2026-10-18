// Menentukan tujuan pembayaran yang valid untuk sebuah wallet_address.
// Dipisah dari WalletContext supaya bisa diuji tanpa wallet / Supabase.

import type { ConnectClient } from '@unicitylabs/sphere-sdk/connect'
import { isChainPubkey, normalizeNametag } from './sphereConnect'

export interface PeerInfoLike {
  nametag?: string
  chainPubkey?: string
  directAddress?: string
}

/** Subset ConnectClient yang dipakai di sini (memudahkan mock di test). */
export type QueryClient = Pick<ConnectClient, 'query'>

export async function resolvePeer(client: QueryClient, identifier: string): Promise<PeerInfoLike | null> {
  try {
    const peer = await client.query<PeerInfoLike | null>('sphere_resolve', { identifier })
    return peer && typeof peer === 'object' ? peer : null
  } catch (err) {
    console.warn('[MUSYAWARAH] sphere_resolve gagal untuk', identifier.slice(0, 24), err)
    return null
  }
}

export interface PayableRecipient {
  /** nilai `to` untuk intent('send') */
  to: string
  /** semua bentuk identitas penerima, buat mencocokkan entri riwayat wallet */
  matchKeys: string[]
}

export interface RecipientDeps {
  /** nametag (tanpa @) yang tersimpan untuk wallet ini, atau null */
  fetchNametag: (wallet: string) => Promise<string | null>
  /** chainPubkey treasury dari env (boleh kosong) */
  treasuryWallet?: string
  /** Unicity ID treasury dari env, mis. "@masyarakat" (boleh kosong) */
  treasuryNametag?: string
}

/**
 * wallet_address di DB = chainPubkey (66 hex). Wallet Unicity TIDAK menerima
 * `DIRECT://<chainPubkey>` (bukan alamat DIRECT yang valid, makanya muncul
 * "Recipient ... has no published chain pubkey"). Yang valid: `@nametag` atau
 * alamat `DIRECT://0000...` hasil resolve. Jadi:
 *   1. resolve chainPubkey -> binding yang dipublish penerima (nametag/DIRECT)
 *   2. kalau tidak ketemu, pakai nametag dari DB/env TAPI wajib terverifikasi:
 *      nametag itu harus resolve ke chainPubkey yang sama. Ini yang mencegah
 *      uang salah alamat walau data profil dimanipulasi.
 * Kalau semua gagal -> throw (uang TIDAK dikirim).
 */
export async function resolvePayableRecipient(
  client: QueryClient,
  wallet: string,
  deps: RecipientDeps
): Promise<PayableRecipient> {
  const raw = wallet.trim()
  const target = raw.replace(/^DIRECT:\/\//i, '').toLowerCase()
  const treasuryWallet = (deps.treasuryWallet ?? '').trim().toLowerCase()
  const treasuryNametag = normalizeNametag(deps.treasuryNametag)

  // Data lama: wallet tersimpan sebagai "@nametag".
  const legacyTag = normalizeNametag(raw)
  if (legacyTag) {
    const peer = await resolvePeer(client, `@${legacyTag}`)
    if (!peer?.chainPubkey) {
      throw new Error(`Unicity ID @${legacyTag} tidak ditemukan di jaringan Unicity.`)
    }
    return { to: `@${legacyTag}`, matchKeys: [legacyTag, peer.chainPubkey.toLowerCase()] }
  }

  if (!isChainPubkey(target)) {
    throw new Error('Alamat penerima tidak valid (bukan chainPubkey maupun Unicity ID).')
  }

  const samePeer = (p: PeerInfoLike | null): p is PeerInfoLike =>
    Boolean(p?.chainPubkey) && p!.chainPubkey!.toLowerCase() === target

  // 1) Resolve lewat chainPubkey. Kalau binding-nya membawa nametag, pakai @nametag.
  const byKey = await resolvePeer(client, target)
  const keyPeer = samePeer(byKey) ? byKey : null
  const keyTag = normalizeNametag(keyPeer?.nametag)
  if (keyPeer && keyTag) {
    return { to: `@${keyTag}`, matchKeys: [target, keyTag, keyPeer.directAddress ?? ''].filter(Boolean) }
  }

  // 2) Nametag dari env (treasury) / DB, wajib lolos verifikasi ke chainPubkey yang sama.
  //    Didahulukan di atas alamat DIRECT: tujuan berawalan "@" adalah yang
  //    terbukti diterima wallet.
  const isTreasury = treasuryWallet !== '' && target === treasuryWallet
  const hint = isTreasury && treasuryNametag ? treasuryNametag : await deps.fetchNametag(target)
  if (hint) {
    const byTag = await resolvePeer(client, `@${hint}`)
    if (samePeer(byTag)) {
      return { to: `@${hint}`, matchKeys: [target, hint, keyPeer?.directAddress ?? ''].filter(Boolean) }
    }
    console.warn(`[MUSYAWARAH] @${hint} tidak resolve ke wallet ${target.slice(0, 10)}…, tidak dipakai.`)
  }

  // 3) Pilihan terakhir: alamat DIRECT hasil resolve (bukan pubkey yang dibungkus).
  if (keyPeer?.directAddress) {
    console.warn('[MUSYAWARAH] Penerima tidak punya Unicity ID terverifikasi, pakai alamat DIRECT hasil resolve.')
    return { to: keyPeer.directAddress, matchKeys: [target, keyPeer.directAddress] }
  }

  const short = `${target.slice(0, 6)}…${target.slice(-4)}`
  throw new Error(
    isTreasury
      ? 'Treasury belum punya Unicity ID yang terverifikasi. Isi VITE_VERIFICATION_TREASURY_NAMETAG (mis. @masyarakat) dengan nametag yang resolve ke wallet treasury, lalu deploy ulang.'
      : `Penerima ${short} belum punya Unicity ID (@id) yang terverifikasi, jadi pembayaran tidak bisa dikirim. Minta dia mendaftarkan Unicity ID di wallet-nya lalu login ulang.`
  )
}
