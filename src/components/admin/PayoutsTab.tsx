import { useState } from 'react'
import { useWallet } from '../../contexts/WalletContext'
import { markOrderReleased, type CompletedOrderRow } from '../../hooks/useOrders'
import { shortenAddress } from '../../utils/avatar'
import { timeAgo } from '../../utils/time'
import { LockIcon } from '../icons'

export function PayoutsTab({
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
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [releaseStep, setReleaseStep] = useState<'sending' | 'confirming' | null>(null)
  const [releaseError, setReleaseError] = useState<{ orderId: string; message: string } | null>(null)

  async function handleRelease(order: CompletedOrderRow) {
    if (!walletAddress) return
    setReleaseError(null)
    setReleasingId(order.id)
    try {
      // 1) Actually send the payout on-chain to the provider first — the
      //    button never marks an order released without a real transfer.
      setReleaseStep('sending')
      const { txHash } = await sendTip(order.provider_wallet, order.amount)
      if (!txHash) {
        throw new Error('The payout transaction did not return a transaction hash — cannot confirm release.')
      }

      // 2) Only then record the release, tied to that unique tx hash. The
      //    database rejects reusing a tx hash on a different order, even if
      //    it's the same recipient and same amount.
      setReleaseStep('confirming')
      await markOrderReleased(order.id, walletAddress, txHash)
      await refresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to release payout. Try again.'
      setReleaseError({ orderId: order.id, message })
      console.error('[MUSYAWARAH] Gagal release payout:', e)
    } finally {
      setReleasingId(null)
      setReleaseStep(null)
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[16px] font-bold text-ink">Release payouts</h2>
        <p className="text-[12px] text-ink-muted">
          Orders whose tasks have been confirmed complete, waiting for funds to be released to the provider.
          Clicking Release sends the payout on-chain to the provider first, then records the release — it
          can't be marked released without a matching transaction.
        </p>
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
                onClick={() => handleRelease(order)}
                disabled={releasingId === order.id}
              >
                <LockIcon size={12} />
                {releasingId === order.id
                  ? releaseStep === 'sending'
                    ? 'Sending payout…'
                    : 'Confirming…'
                  : 'Release'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
