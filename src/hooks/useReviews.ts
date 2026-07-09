import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { ProviderReputation } from '../types'

// ============================================================================
// MARKETPLACE REVIEWS (Fase 4) — dipisah dari useOrders.ts biar konsisten
// sama pola pemisahan hook per area fitur (lihat catatan di useOrders.ts).
// ============================================================================

/** Kirim review buat suatu order -- dipanggil dari prompt "Leave a review"
 * di chip order_update status 'released' (OrderUpdateChip.tsx). */
export async function submitReview(
  orderId: string,
  reviewerWallet: string,
  rating: number,
  comment: string
) {
  const { error } = await supabase.rpc('submit_review', {
    p_order_id: orderId,
    p_reviewer_wallet: reviewerWallet,
    p_rating: rating,
    p_comment: comment.trim() || null,
  })
  if (error) throw error
}

/** Rata-rata rating + jumlah review buat 1 wallet (dari `get_provider_reputation`).
 * Dipakai di ProfilePage, di sebelah VerifiedBadge -- cuma tampil kalau
 * `review_count > 0`. */
export function useProviderReputation(wallet: string | null | undefined) {
  const [reputation, setReputation] = useState<ProviderReputation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!wallet) {
      setReputation(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .rpc('get_provider_reputation', { p_wallet: wallet })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[MUSYAWARAH] Gagal ngambil reputasi provider:', error)
          setReputation(null)
        } else {
          const row = Array.isArray(data) ? data[0] : data
          setReputation(row ? { avg_rating: Number(row.avg_rating), review_count: Number(row.review_count) } : null)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [wallet])

  return { reputation, loading }
}

/** Set `order_id` yang udah pernah direview `myWallet` -- dipakai buat
 * nyembunyiin prompt "Leave a review" di chip order_update kalau udah
 * pernah dikirim, tanpa perlu nunggu refresh thread penuh. Dibatch sekali
 * per daftar order_id, sama pola kayak useOrderSnapshots di useOrders.ts. */
export function useMyReviewedOrderIds(orderIds: string[], myWallet: string | null) {
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!myWallet || orderIds.length === 0) {
      setReviewedIds(new Set())
      return
    }
    let cancelled = false
    supabase
      .from('reviews')
      .select('order_id')
      .eq('reviewer_wallet', myWallet)
      .in('order_id', orderIds)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[MUSYAWARAH] Gagal ngambil status review:', error)
          return
        }
        setReviewedIds(new Set((data ?? []).map((r) => r.order_id as string)))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIds.join(','), myWallet])

  return reviewedIds
}
