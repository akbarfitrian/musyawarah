import { useState } from 'react'
import { useWallet } from '../../contexts/WalletContext'
import { markOrderRefunded, type CompletedOrderRow } from '../../hooks/useOrders'
import { shortenAddress } from '../../utils/avatar'
import { timeAgo } from '../../utils/time'
import { RefundIcon } from '../icons'

export function RefundsTab({
  orders,
  loading,
  error,
  refresh,
}: {
  orders: CompletedOrderRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}) {
  const { walletAddress, sendTip } = useWallet()
  const [refundingId, setRefundingId] = useState<string | null>(null)
  const [refundStep, setRefundStep] = useState<'sending' | 'confirming' | null>(null)
  const [refundError, setRefundError] = useState<{ orderId: string; message: string } | null>(null)

  async function handleRefund(order: CompletedOrderRow) {
    if (!walletAddress) return
    setRefundError(null)
    setRefundingId(order.id)
    try {
      // 1) Actually send the refund on-chain to the buyer first — the
      //    button never marks an order refunded without a real transfer.
      setRefundStep('sending')
      const { txHash } = await sendTip(order.buyer_wallet, order.amount)
      if (!txHash) {
        throw new Error('The refund transaction did not return a transaction hash — cannot confirm refund.')
      }

      // 2) Only then record the refund, tied to that unique tx hash. The
      //    database rejects reusing a tx hash on a different order, even if
      //    it's the same recipient and same amount.
      setRefundStep('confirming')
      await markOrderRefunded(order.id, walletAddress, txHash)
      await refresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to refund buyer. Try again.'
      setRefundError({ orderId: order.id, message })
      console.error('[MUSYAWARAH] Gagal refund buyer:', e)
    } finally {
      setRefundingId(null)
      setRefundStep(null)
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[16px] font-bold text-ink">Refunds</h2>
        <p className="text-[12px] text-ink-muted">
          Disputed orders where the provider never delivered and never responded — flagged after the 48h window,
          waiting for the escrowed amount to be sent back to the buyer. Clicking Refund sends the money on-chain
          to the buyer first, then records the refund — it can't be marked refunded without a matching
          transaction.
        </p>
      </div>

      {loading ? (
        <p className="py-8 text-center text-[13px] text-ink-muted">Loading…</p>
      ) : error ? (
        <p className="py-8 text-center text-[13px] text-danger">{error}</p>
      ) : orders.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-muted">No orders waiting for a refund.</p>
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
                onClick={() => handleRefund(order)}
                disabled={refundingId === order.id}
              >
                <RefundIcon size={12} />
                {refundingId === order.id
                  ? refundStep === 'sending'
                    ? 'Sending refund…'
                    : 'Confirming…'
                  : 'Refund'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
