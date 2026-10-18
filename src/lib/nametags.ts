// Cache wallet_address (chainPubkey) -> Unicity ID (@nametag).
//
// Sumbernya tabel `wallet_nametags` (read-only dari client, ditulis lewat RPC
// set_my_nametag setelah login). Dipakai untuk:
//   - tampilan: tampilkan "@alice" alih-alih "03cf9f…0a"
//   - petunjuk tujuan pembayaran di sendTip(). Nilai dari sini TIDAK pernah
//     dipercaya mentah: WalletContext memverifikasinya ke wallet lewat
//     sphere_resolve (nametag harus resolve ke chainPubkey yang sama).

import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../supabaseClient'

const cache = new Map<string, string | null>() // wallet -> nametag (tanpa @) | null = belum punya
const queue = new Set<string>()
const listeners = new Set<() => void>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

const key = (wallet: string) => wallet.trim().toLowerCase()

function emit() {
  listeners.forEach((l) => l())
}

async function flush() {
  flushTimer = null
  const batch = [...queue]
  queue.clear()
  if (batch.length === 0) return

  try {
    const { data, error } = await supabase
      .from('wallet_nametags')
      .select('wallet_address, nametag')
      .in('wallet_address', batch)
    if (error) throw error

    const found = new Map<string, string>()
    for (const row of (data ?? []) as { wallet_address: string; nametag: string }[]) {
      found.set(row.wallet_address.toLowerCase(), row.nametag)
    }
    for (const w of batch) cache.set(w, found.get(w) ?? null)
  } catch (e) {
    // Jangan di-cache: biar bisa dicoba lagi (mis. tabel belum dimigrasi).
    console.warn('[MUSYAWARAH] Gagal ambil nametag:', e)
  } finally {
    emit()
  }
}

/** Minta nametag untuk `wallet`; permintaan dalam 30ms digabung jadi 1 query. */
export function requestNametag(wallet: string | null | undefined) {
  if (!wallet) return
  const k = key(wallet)
  if (cache.has(k) || queue.has(k)) return
  queue.add(k)
  if (!flushTimer) flushTimer = setTimeout(flush, 30)
}

export function getCachedNametag(wallet: string | null | undefined): string | null {
  return wallet ? (cache.get(key(wallet)) ?? null) : null
}

/** Dipakai setelah set_my_nametag sukses supaya UI langsung ikut berubah. */
export function setCachedNametag(wallet: string, nametag: string | null) {
  cache.set(key(wallet), nametag)
  emit()
}

/** Versi async (untuk logic non-React). Selalu baca DB kalau belum ada di cache. */
export async function fetchNametag(wallet: string): Promise<string | null> {
  const k = key(wallet)
  if (cache.has(k)) return cache.get(k) ?? null
  try {
    const { data, error } = await supabase
      .from('wallet_nametags')
      .select('nametag')
      .eq('wallet_address', k)
      .maybeSingle()
    if (error) throw error
    const tag = (data as { nametag?: string } | null)?.nametag ?? null
    cache.set(k, tag)
    return tag
  } catch (e) {
    console.warn('[MUSYAWARAH] fetchNametag gagal:', e)
    return null
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Nametag (tanpa "@") untuk wallet ini, atau null kalau belum punya/belum dimuat. */
export function useNametag(wallet: string | null | undefined): string | null {
  useEffect(() => {
    requestNametag(wallet)
  }, [wallet])
  return useSyncExternalStore(
    subscribe,
    () => getCachedNametag(wallet),
    () => null
  )
}
