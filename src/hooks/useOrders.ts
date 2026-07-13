import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { Message, Order, OrderUpdatePayload } from '../types'

// ============================================================================
// MARKETPLACE ORDERS (Fase 3.2) — dipisah dari useMessages.ts biar file itu
// gak makin gemuk (lihat catatan di musyawarah-marketplace-fase-3.2-dst.md
// §3.2 poin 1: "atau file baru useOrders.ts kalau mau dipisah").
// ============================================================================

/** Wallet treasury platform — dipakai dobel buat verifikasi & escrow (draft
 * §6, keputusan b). Sama persis konstanta yang dipakai useVerification.ts. */
export const TREASURY_WALLET = import.meta.env.VITE_VERIFICATION_TREASURY_WALLET as string | undefined

/** Ambil data `orders` (status/amount/dst) buat sekumpulan `order_id` yang
 * muncul di payload pesan `order_update` sepanjang satu thread -- dibatch
 * sekali per refresh, pola sama kayak useListingSnapshots di useMessages.ts.
 * order_id sudah ada langsung di payload, jadi gak perlu nebak lewat
 * kombinasi post_id+buyer_wallet+provider_wallet. */
export function useOrderSnapshots(messages: Message[]) {
  const [orders, setOrders] = useState<Record<string, Order>>({})

  useEffect(() => {
    const orderIds = [
      ...new Set(
        messages
          .filter((m) => m.kind === 'order_update')
          .map((m) => (m.payload as OrderUpdatePayload | null)?.order_id)
          .filter((id): id is string => Boolean(id))
      ),
    ]

    if (orderIds.length === 0) {
      setOrders({})
      return
    }

    let cancelled = false
    supabase
      .from('orders')
      .select('*')
      .in('id', orderIds)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[MUSYAWARAH] Gagal ngambil data order buat chip order_update:', error)
          return
        }
        const byId: Record<string, Order> = {}
        for (const row of (data ?? []) as Order[]) {
          byId[row.id] = row
        }
        setOrders(byId)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.map((m) => m.id).join(',')])

  return orders
}

/** Semua `orders` di mana `wallet` jadi buyer ATAU provider -- dipakai sub-
 * tab "My Orders" di `MarketplacePage.tsx` (Fase 4). Halaman ini murni
 * overview, jadi cuma butuh daftar order + status-nya, bukan aksi apa pun
 * (lock/confirm/review tetap dilakukan di dalam chat). */
export function useMyOrders(wallet: string | null) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!wallet) {
      setOrders([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .from('orders')
      .select('*')
      .or(`buyer_wallet.eq.${wallet},provider_wallet.eq.${wallet}`)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[MUSYAWARAH] Gagal ngambil order buat MarketplacePage:', error)
          setOrders([])
        } else {
          setOrders((data ?? []) as Order[])
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [wallet])

  return { orders, loading }
}

/** Kunci dana escrow buat suatu order -- dipanggil abis `sendTip()` sukses
 * (lihat MessagesPage.tsx, tombol "Lock escrow" di chip order_update status
 * 'pending'). Pola sama kayak sendListingRefMessage di useMessages.ts. */
export async function lockEscrowOrder(orderId: string, buyerWallet: string, lockTxHash: string) {
  const { error } = await supabase.rpc('lock_escrow_order', {
    p_order_id: orderId,
    p_buyer_wallet: buyerWallet,
    p_lock_tx_hash: lockTxHash,
  })
  if (error) throw error
}

/** Buyer konfirmasi kerjaan selesai (Fase 3.3) -- gak nyentuh wallet sama
 * sekali, RPC saja. Chip baru (`order_update: completed`) otomatis muncul
 * dari `confirm_order_complete` sendiri, tinggal refresh thread. */
export async function confirmOrderComplete(orderId: string, buyerWallet: string) {
  const { error } = await supabase.rpc('confirm_order_complete', {
    p_order_id: orderId,
    p_buyer_wallet: buyerWallet,
  })
  if (error) throw error
}

/** Provider klik "Mark as delivered" di chip order_update status 'locked'
 * (Fase 3.5, 015) -- taro LINK hasil kerjaan (bukan upload file, platform
 * ini gak punya storage buat itu) biar buyer keliatan jelas apa yang mau
 * di-confirm, dipisah dari chat bebas. Cuma bisa sekali per order (RPC nolak
 * kalau deliverable_url udah keisi). Gak ngeblok confirm_order_complete --
 * buyer tetap boleh confirm kapan aja selama 'locked', ini murni buat
 * kejelasan, bukan gerbang wajib. */
export async function markOrderDelivered(orderId: string, providerWallet: string, deliverableUrl: string) {
  const { error } = await supabase.rpc('mark_order_delivered', {
    p_order_id: orderId,
    p_provider_wallet: providerWallet,
    p_deliverable_url: deliverableUrl,
  })
  if (error) throw error
}

/** Buyer ATAU provider batalin order yang masih 'pending' (belum ada dana di
 * escrow sama sekali) -- lihat 011_cancel_and_supersede_orders.sql. Order
 * yang udah 'locked' gak bisa lewat sini (harus dispute manual). */
export async function cancelOrder(orderId: string, wallet: string) {
  const { error } = await supabase.rpc('cancel_order', {
    p_order_id: orderId,
    p_wallet: wallet,
  })
  if (error) throw error
}

/** Buyer klik "Dispute" di chip order_update status 'locked' (setelah
 * deliverable ada) -- 019/020. HANYA bisa sekali per order (RPC nolak kalau
 * `dispute_used` udah true); order pindah ke 'disputed', nunggu seller balas
 * pakai `submitDeliverableRevision`. Chip baru ("Buyer disputed...")
 * otomatis muncul dari RPC itu sendiri, tinggal refresh thread. */
export async function disputeOrder(orderId: string, buyerWallet: string, reason: string) {
  const { error } = await supabase.rpc('dispute_order', {
    p_order_id: orderId,
    p_buyer_wallet: buyerWallet,
    p_reason: reason,
  })
  if (error) throw error
}

/** Provider klik "Submit revision" di chip order_update status 'disputed'
 * (019) -- BEDA dari `markOrderDelivered` (015, cuma sekali & cuma kalau
 * deliverable_url masih kosong): ini KHUSUS buat NIMPA deliverable_url yang
 * sudah ada sebagai balasan dispute. Order balik ke 'locked', jam konfirmasi
 * 72 jam (018) restart dari titik ini. Boleh dipanggil buat kedua jenis
 * dispute (manual 019 maupun auto-flag non-delivery 017) -- RPC-nya cuma
 * syaratin status = 'disputed', gak peduli dispute_reason apa. */
export async function submitDeliverableRevision(orderId: string, providerWallet: string, deliverableUrl: string) {
  const { error } = await supabase.rpc('submit_deliverable_revision', {
    p_order_id: orderId,
    p_provider_wallet: providerWallet,
    p_deliverable_url: deliverableUrl,
  })
  if (error) throw error
}

/** Operator klik "Release" di AdminPage.tsx (011.1) -- RPC divalidasi ketat
 * di server terhadap TREASURY_WALLET (lihat mark_order_released di
 * 008/010_fix_treasury_wallet.sql), jadi `operatorWallet` di sini cuma buat
 * ngirim parameter, bukan lapisan otorisasi -- yang beneran ngeblok wallet
 * lain adalah check di dalam function itu sendiri. */
export async function markOrderReleased(orderId: string, operatorWallet: string) {
  const { error } = await supabase.rpc('mark_order_released', {
    p_order_id: orderId,
    p_operator_wallet: operatorWallet,
  })
  if (error) throw error
}

/** Operator klik "Refund" di AdminPage.tsx (021.1) -- paralel persis sama
 * `markOrderReleased` di atas: RPC (`mark_order_refunded`, 021) divalidasi
 * ketat di server terhadap TREASURY_WALLET, jadi `operatorWallet` di sini
 * cuma buat ngirim parameter, bukan lapisan otorisasi. RPC-nya sendiri juga
 * nolak kalau order belum ditandai `refund_flagged_at` (belum lewat window
 * 48 jam dari 021) -- error itu ditampilin apa adanya ke operator lewat
 * `refundError` di AdminPage, bukan di-guard duluan di sini, biar satu-
 * satunya sumber kebenaran soal "boleh refund atau belum" tetap di server. */
export async function markOrderRefunded(orderId: string, operatorWallet: string) {
  const { error } = await supabase.rpc('mark_order_refunded', {
    p_order_id: orderId,
    p_operator_wallet: operatorWallet,
  })
  if (error) throw error
}

export interface CompletedOrderRow extends Order {
  listing_title: string | null
}

/** Semua order status 'completed' -- kandidat "nunggu payout manual" yang
 * ditampilin di AdminPage.tsx buat operator (treasury wallet) klik Release.
 * Sengaja query langsung (bukan RPC) karena baca `orders` udah public-select
 * (lihat 007), dan halaman ini sendiri yang jadi gerbang otorisasi di sisi
 * UI -- RPC-nya sendiri (mark_order_released) tetap divalidasi ketat di
 * server terlepas dari halaman ini. */
export function useCompletedOrders() {
  const [orders, setOrders] = useState<CompletedOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: queryError } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: true })

      if (queryError) throw queryError
      const rows = (data ?? []) as Order[]

      // Ambil judul listing buat konteks di kartu -- batch sekali, pola sama
      // kayak useListingSnapshots di useMessages.ts. Best-effort: kalau gagal,
      // kartu tetap muncul cuma tanpa judul (fallback "Untitled listing").
      const postIds = [...new Set(rows.map((o) => o.post_id))]
      let titleById: Record<string, string | null> = {}
      if (postIds.length > 0) {
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('id, listing_title')
          .in('id', postIds)
        if (postsError) {
          console.warn('[MUSYAWARAH] Gagal ngambil judul listing buat AdminPage:', postsError)
        } else {
          titleById = Object.fromEntries(
            ((postsData ?? []) as { id: string; listing_title: string | null }[]).map((p) => [p.id, p.listing_title])
          )
        }
      }

      setOrders(rows.map((o) => ({ ...o, listing_title: titleById[o.post_id] ?? null })))
    } catch (e) {
      setError('Failed to load completed orders.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { orders, loading, error, refresh }
}

/** Semua order status 'disputed' yang `refund_flagged_at` udah keisi (021,
 * lihat auto_flag_refund_eligible_disputes) -- kandidat "nunggu refund
 * manual" yang ditampilin di AdminPage.tsx buat operator klik Refund.
 * Struktur & alasan query-nya sama persis kayak `useCompletedOrders` di
 * atas: baca langsung tabel `orders` (udah public-select, 007), halaman itu
 * sendiri yang jadi gerbang otorisasi UI, RPC (`mark_order_refunded`) tetap
 * divalidasi ketat di server terlepas dari sini. */
export function useRefundEligibleOrders() {
  const [orders, setOrders] = useState<CompletedOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: queryError } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'disputed')
        .not('refund_flagged_at', 'is', null)
        .order('refund_flagged_at', { ascending: true })

      if (queryError) throw queryError
      const rows = (data ?? []) as Order[]

      const postIds = [...new Set(rows.map((o) => o.post_id))]
      let titleById: Record<string, string | null> = {}
      if (postIds.length > 0) {
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('id, listing_title')
          .in('id', postIds)
        if (postsError) {
          console.warn('[MUSYAWARAH] Gagal ngambil judul listing buat AdminPage (refund):', postsError)
        } else {
          titleById = Object.fromEntries(
            ((postsData ?? []) as { id: string; listing_title: string | null }[]).map((p) => [p.id, p.listing_title])
          )
        }
      }

      setOrders(rows.map((o) => ({ ...o, listing_title: titleById[o.post_id] ?? null })))
    } catch (e) {
      setError('Failed to load refund-eligible orders.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { orders, loading, error, refresh }
}
