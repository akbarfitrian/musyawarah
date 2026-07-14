import { useState } from 'react'
import { useWallet } from '../contexts/WalletContext'
import {
  TREASURY_WALLET,
  markOrderReleased,
  markOrderRefunded,
  useCompletedOrders,
  useRefundEligibleOrders,
} from '../hooks/useOrders'
import { shortenAddress } from '../utils/avatar'
import { timeAgo } from '../utils/time'
import { ChevronLeftIcon, LockIcon, RefundIcon } from './icons'

export function AdminPage({ onBack }: { onBack: () => void }) {
  const { walletAddress } = useWallet()
  const isTreasury = Boolean(walletAddress) && walletAddress === TREASURY_WALLET
  const { orders, loading, error, refresh } = useCompletedOrders()
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [releaseError, setReleaseError] = useState<{ orderId: string; message: string } | null>(null)

  const { orders: refundOrders, loading: refundLoading, error: refundListError, refresh: refreshRefunds } =
    useRefundEligibleOrders()
  const [refundingId, setRefundingId] = useState<string | null>(null)
  const [refundError, setRefundError] = useState<{ orderId: string; message: string } | null>(null)

  async function handleRelease(orderId: string) {
    if (!walletAddress) return
    setReleaseError(null)
    setReleasingId(orderId)
    try {
      await markOrderReleased(orderId, walletAddress)
      await refresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to release payout. Try again.'
      setReleaseError({ orderId, message })
      console.error('[MUSYAWARAH] Gagal release payout:', e)
    } finally {
      setReleasingId(null)
    }
  }

  async function handleRefund(orderId: string) {
    if (!walletAddress) return
    setRefundError(null)
    setRefundingId(orderId)
    try {
      await markOrderRefunded(orderId, walletAddress)
      await refreshRefunds()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to refund buyer. Try again.'
      setRefundError({ orderId, message })
      console.error('[MUSYAWARAH] Gagal refund buyer:', e)
    } finally {
      setRefundingId(null)
    }
  }

  if (!isTreasury) {
    return (
      <div className="py-16 text-center">
        <p className="text-[14px] text-ink-muted">This page can only be accessed by the treasury/operator wallet.</p>
        <button
          type="button"
          className="mt-3 rounded-full bg-surface px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-hover"
          onClick={onBack}
        >
          Back home
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          onClick={onBack}
          aria-label="Back"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <div>
          <h2 className="text-[16px] font-bold text-ink">Release payouts</h2>
          <p className="text-[12px] text-ink-muted">
            Orders whose tasks have been confirmed complete, waiting for funds to be released to the provider.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-[13px] text-ink-muted">Loading…</p>
      ) : error ? (
        <p className="py-8 text-center text-[13px] text-danger">{error}</p>
      ) : orders.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-muted">No orders waiting for payout release.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-ink">{order.listing_title ?? 'Untitled listing'}</p>
                <p className="truncate text-[12px] text-ink-muted">
                  {shortenAddress(order.buyer_wallet)} → {shortenAddress(order.provider_wallet)} · {order.amount}{' '}
                  {order.coin_symbol}
                </p>
                <p className="text-[11px] text-ink-faint">
                  Confirmed {order.completed_at ? timeAgo(order.completed_at) : '—'}
                </p>
                {releaseError?.orderId === order.id && (
                  <p className="mt-1 text-[11px] text-danger">{releaseError.message}</p>
                )}
              </div>
              <button
                type="button"
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-[12px] font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
                onClick={() => handleRelease(order.id)}
                disabled={releasingId === order.id}
              >
                <LockIcon size={12} />
                {releasingId === order.id ? 'Releasing…' : 'Release'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 mt-8">
        <h2 className="text-[16px] font-bold text-ink">Refunds</h2>
        <p className="text-[12px] text-ink-muted">
          Disputed orders where the provider never delivered and never responded — flagged after the 48h window,
          waiting for the escrowed amount to be sent back to the buyer.
        </p>
      </div>

      {refundLoading ? (
        <p className="py-8 text-center text-[13px] text-ink-muted">Loading…</p>
      ) : refundListError ? (
        <p className="py-8 text-center text-[13px] text-danger">{refundListError}</p>
      ) : refundOrders.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-muted">No orders waiting for a refund.</p>
      ) : (
        <div className="space-y-2">
          {refundOrders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-ink">{order.listing_title ?? 'Untitled listing'}</p>
                <p className="truncate text-[12px] text-ink-muted">
                  {shortenAddress(order.provider_wallet)} → {shortenAddress(order.buyer_wallet)} · {order.amount}{' '}
                  {order.coin_symbol}
                </p>
                <p className="text-[11px] text-ink-faint">
                  Flagged {order.refund_flagged_at ? timeAgo(order.refund_flagged_at) : '—'} · provider never
                  delivered
                </p>
                {refundError?.orderId === order.id && (
                  <p className="mt-1 text-[11px] text-danger">{refundError.message}</p>
                )}
              </div>
              <button
                type="button"
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-danger px-3.5 py-1.5 text-[12px] font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
                onClick={() => handleRefund(order.id)}
                disabled={refundingId === order.id}
              >
                <RefundIcon size={12} />
                {refundingId === order.id ? 'Refunding…' : 'Refund'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
