import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { Message, Order, OrderUpdatePayload } from '../types'

export const TREASURY_WALLET = import.meta.env.VITE_VERIFICATION_TREASURY_WALLET as string | undefined

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
  }, [messages.map((m) => m.id).join(',')])

  return orders
}

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

export async function beginEscrowLock(orderId: string, buyerWallet: string) {
  const { error } = await supabase.rpc('begin_escrow_lock', {
    p_order_id: orderId,
    p_buyer_wallet: buyerWallet,
  })
  if (error) throw error
}

export async function lockEscrowOrder(orderId: string, buyerWallet: string, lockTxHash: string) {
  const { error } = await supabase.rpc('lock_escrow_order', {
    p_order_id: orderId,
    p_buyer_wallet: buyerWallet,
    p_lock_tx_hash: lockTxHash,
  })
  if (error) throw error
}

export async function abortEscrowLock(orderId: string, buyerWallet: string) {
  const { error } = await supabase.rpc('abort_escrow_lock', {
    p_order_id: orderId,
    p_buyer_wallet: buyerWallet,
  })
  if (error) throw error
}

export async function confirmOrderComplete(orderId: string, buyerWallet: string) {
  const { error } = await supabase.rpc('confirm_order_complete', {
    p_order_id: orderId,
    p_buyer_wallet: buyerWallet,
  })
  if (error) throw error
}

export async function markOrderDelivered(orderId: string, providerWallet: string, deliverableUrl: string) {
  const { error } = await supabase.rpc('mark_order_delivered', {
    p_order_id: orderId,
    p_provider_wallet: providerWallet,
    p_deliverable_url: deliverableUrl,
  })
  if (error) throw error
}

export async function cancelOrder(orderId: string, wallet: string) {
  const { error } = await supabase.rpc('cancel_order', {
    p_order_id: orderId,
    p_wallet: wallet,
  })
  if (error) throw error
}

export async function disputeOrder(orderId: string, buyerWallet: string, reason: string) {
  const { error } = await supabase.rpc('dispute_order', {
    p_order_id: orderId,
    p_buyer_wallet: buyerWallet,
    p_reason: reason,
  })
  if (error) throw error
}

export async function submitDeliverableRevision(orderId: string, providerWallet: string, deliverableUrl: string) {
  const { error } = await supabase.rpc('submit_deliverable_revision', {
    p_order_id: orderId,
    p_provider_wallet: providerWallet,
    p_deliverable_url: deliverableUrl,
  })
  if (error) throw error
}

export async function markOrderReleased(orderId: string, operatorWallet: string, releaseTxHash: string) {
  const { error } = await supabase.rpc('mark_order_released', {
    p_order_id: orderId,
    p_operator_wallet: operatorWallet,
    p_release_tx_hash: releaseTxHash,
  })
  if (error) throw error
}

export async function markOrderRefunded(orderId: string, operatorWallet: string, refundTxHash: string) {
  const { error } = await supabase.rpc('mark_order_refunded', {
    p_order_id: orderId,
    p_operator_wallet: operatorWallet,
    p_refund_tx_hash: refundTxHash,
  })
  if (error) throw error
}

export interface CompletedOrderRow extends Order {
  listing_title: string | null
}

export function useCompletedOrders() {
  const [orders, setOrders] = useState<CompletedOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const { data, error: queryError } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: true })

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
          console.warn('[MUSYAWARAH] Gagal ngambil judul listing buat AdminPage:', postsError)
        } else {
          titleById = Object.fromEntries(
            ((postsData ?? []) as { id: string; listing_title: string | null }[]).map((p) => [p.id, p.listing_title])
          )
        }
      }

      const nextRows = rows.map((o) => ({ ...o, listing_title: titleById[o.post_id] ?? null }))
      setOrders((prev) => {
        const same =
          prev.length === nextRows.length &&
          prev.every((o, i) => o.id === nextRows[i].id && o.status === nextRows[i].status)
        return same ? prev : nextRows
      })
    } catch (e) {
      if (showSpinner) setError('Failed to load completed orders.')
      console.error(e)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [])

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') load(false)
    }
    const interval = setInterval(tick, 5000)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [load])

  return { orders, loading, error, refresh }
}

export interface AuditLogRow extends CompletedOrderRow {
  action: 'released' | 'refunded'
  actioned_at: string
}

export function useOrderAuditLog(limit = 100) {
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const [releasedRes, refundedRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('status', 'released')
          .order('released_at', { ascending: false })
          .limit(limit),
        supabase
          .from('orders')
          .select('*')
          .eq('status', 'refunded')
          .order('refunded_at', { ascending: false })
          .limit(limit),
      ])

      if (releasedRes.error) throw releasedRes.error
      if (refundedRes.error) throw refundedRes.error

      const released = (releasedRes.data ?? []) as Order[]
      const refunded = (refundedRes.data ?? []) as Order[]

      const postIds = [...new Set([...released, ...refunded].map((o) => o.post_id))]
      let titleById: Record<string, string | null> = {}
      if (postIds.length > 0) {
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('id, listing_title')
          .in('id', postIds)
        if (postsError) {
          console.warn('[MUSYAWARAH] Gagal ngambil judul listing buat Audit Log:', postsError)
        } else {
          titleById = Object.fromEntries(
            ((postsData ?? []) as { id: string; listing_title: string | null }[]).map((p) => [p.id, p.listing_title])
          )
        }
      }

      const merged: AuditLogRow[] = [
        ...released.map((o) => ({
          ...o,
          listing_title: titleById[o.post_id] ?? null,
          action: 'released' as const,
          actioned_at: o.released_at ?? o.completed_at ?? o.created_at,
        })),
        ...refunded.map((o) => ({
          ...o,
          listing_title: titleById[o.post_id] ?? null,
          action: 'refunded' as const,
          actioned_at: o.refunded_at ?? o.completed_at ?? o.created_at,
        })),
      ].sort((a, b) => new Date(b.actioned_at).getTime() - new Date(a.actioned_at).getTime())

      setRows((prev) => {
        const same =
          prev.length === merged.length &&
          prev.every((r, i) => r.id === merged[i].id && r.action === merged[i].action)
        return same ? prev : merged
      })
    } catch (e) {
      if (showSpinner) setError('Failed to load audit log.')
      console.error(e)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [limit])

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') load(false)
    }
    const interval = setInterval(tick, 5000)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [load])

  return { rows, loading, error, refresh }
}

export function useRefundEligibleOrders() {
  const [orders, setOrders] = useState<CompletedOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true)
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

      const nextRows = rows.map((o) => ({ ...o, listing_title: titleById[o.post_id] ?? null }))
      setOrders((prev) => {
        const same =
          prev.length === nextRows.length &&
          prev.every((o, i) => o.id === nextRows[i].id && o.status === nextRows[i].status)
        return same ? prev : nextRows
      })
    } catch (e) {
      if (showSpinner) setError('Failed to load refund-eligible orders.')
      console.error(e)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [])

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') load(false)
    }
    const interval = setInterval(tick, 5000)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [load])

  return { orders, loading, error, refresh }
}
