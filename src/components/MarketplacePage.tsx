import { useState } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { usePosts, setListingActive } from '../hooks/usePosts'
import { useMyOrders } from '../hooks/useOrders'
import { shortenAddress } from '../utils/avatar'
import { timeAgo } from '../utils/time'
import { BriefcaseIcon, MessageIcon, TagIcon } from './icons'
import type { Order, OrderStatus } from '../types'

// ============================================================================
// FASE 4 — Halaman Marketplace: sub-tab "My Listings" (toggle aktif/nonaktif
// + link permalink) & "My Orders" (dikelompokkan per status, link ke thread
// DM terkait). Murni overview -- semua aksi (lock/confirm/review) tetap
// dilakukan di dalam chat, gak dobel di sini. Lihat draft ringkas §3 & §4.
// ============================================================================

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  locked: 'Locked',
  completed: 'Completed',
  released: 'Released',
  disputed: 'Disputed',
}

const STATUS_ORDER: OrderStatus[] = ['pending', 'locked', 'completed', 'released', 'disputed']

function ListingsTab({
  myWallet,
  onVisitPost,
}: {
  myWallet: string
  onVisitPost?: (postId: string) => void
}) {
  const { posts, loading, refresh } = usePosts(myWallet)
  const listings = posts.filter((p) => p.is_listing)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle(postId: string, nextActive: boolean) {
    setError(null)
    setTogglingId(postId)
    try {
      await setListingActive(myWallet, postId, nextActive)
      await refresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update listing status. Try again.'
      setError(message)
      console.error(e)
    } finally {
      setTogglingId(null)
    }
  }

  if (loading) return <p className="py-10 text-center text-[13px] text-ink-muted">Loading listings…</p>

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center">
        <BriefcaseIcon size={26} />
        <p className="max-w-[240px] text-[13px] text-ink-muted">
          No skill listings yet. Post one from Home with "Post skill listing".
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-surface-border">
      {error && <p className="px-4 py-2 text-[12px] text-danger">{error}</p>}
      {listings.map((listing) => (
        <div key={listing.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onVisitPost?.(listing.id)}
          >
            <div className="flex items-center gap-1.5">
              <BriefcaseIcon size={13} />
              <span className="truncate text-[14px] font-semibold text-ink">{listing.listing_title}</span>
              {!listing.listing_active && (
                <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-faint">
                  Inactive
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-muted">
              <span className="font-mono font-semibold text-gold">
                {listing.listing_price_amount} {listing.listing_coin_symbol ?? 'UCT'}
              </span>
              {listing.listing_category && (
                <span className="inline-flex items-center gap-1">
                  <TagIcon size={10} />
                  {listing.listing_category}
                </span>
              )}
            </div>
          </button>
          <button
            type="button"
            className="shrink-0 rounded-full border border-surface-border px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-hover disabled:opacity-50"
            onClick={() => handleToggle(listing.id, !listing.listing_active)}
            disabled={togglingId === listing.id}
          >
            {togglingId === listing.id ? 'Saving…' : listing.listing_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ))}
    </div>
  )
}

function OrderRow({
  order,
  myWallet,
  onOpenThread,
}: {
  order: Order
  myWallet: string
  onOpenThread?: (wallet: string) => void
}) {
  const otherWallet = order.buyer_wallet === myWallet ? order.provider_wallet : order.buyer_wallet
  const role = order.buyer_wallet === myWallet ? 'Buying' : 'Selling'

  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/60"
      onClick={() => onOpenThread?.(otherWallet)}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="font-semibold text-ink">{role}</span>
          <span className="text-ink-faint">·</span>
          <span className="font-mono text-ink-muted">{shortenAddress(otherWallet)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-muted">
          <span className="font-mono font-semibold text-gold">
            {order.amount} {order.coin_symbol}
          </span>
          <span>· {timeAgo(order.created_at)}</span>
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted">
        <MessageIcon size={11} />
        {STATUS_LABEL[order.status]}
      </span>
    </button>
  )
}

function OrdersTab({ myWallet, onOpenThread }: { myWallet: string; onOpenThread?: (wallet: string) => void }) {
  const { orders, loading } = useMyOrders(myWallet)

  if (loading) return <p className="py-10 text-center text-[13px] text-ink-muted">Loading orders…</p>

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center">
        <MessageIcon size={26} />
        <p className="max-w-[240px] text-[13px] text-ink-muted">
          No orders yet. Hire a listing or get hired to see it here.
        </p>
      </div>
    )
  }

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: orders.filter((o) => o.status === status),
  })).filter((g) => g.items.length > 0)

  return (
    <div>
      {grouped.map((g) => (
        <div key={g.status}>
          <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {STATUS_LABEL[g.status]}
          </p>
          <div className="divide-y divide-surface-border border-b border-surface-border">
            {g.items.map((order) => (
              <OrderRow key={order.id} order={order} myWallet={myWallet} onOpenThread={onOpenThread} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function MarketplacePage({
  tab,
  onChangeTab,
  onOpenThread,
  onVisitPost,
}: {
  tab: 'listings' | 'orders'
  onChangeTab: (tab: 'listings' | 'orders') => void
  onOpenThread?: (wallet: string) => void
  onVisitPost?: (postId: string) => void
}) {
  const { walletAddress: myWallet, isAutoConnecting, connecting, connect } = useWallet()

  if (isAutoConnecting) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-ink-muted">Checking wallet…</p>
      </div>
    )
  }

  if (!myWallet) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-ink-muted">Connect your wallet to see your listings & orders.</p>
        <button
          className="rounded-full bg-brand-gradient px-6 py-2.5 text-[15px] font-semibold text-accent-contrast shadow-glow transition-transform duration-150 hover:scale-[1.03] active:scale-95 disabled:opacity-60"
          onClick={connect}
          disabled={connecting}
        >
          {connecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
      </div>
    )
  }

  return (
    <div className="-mx-4">
      <div className="mx-4 mb-1 flex gap-1 border-b border-surface-border">
        <button
          type="button"
          className={`px-3 pb-2.5 text-[14px] font-semibold transition-colors ${
            tab === 'listings' ? 'border-b-2 border-gold text-ink' : 'text-ink-muted hover:text-ink'
          }`}
          onClick={() => onChangeTab('listings')}
        >
          My Listings
        </button>
        <button
          type="button"
          className={`px-3 pb-2.5 text-[14px] font-semibold transition-colors ${
            tab === 'orders' ? 'border-b-2 border-gold text-ink' : 'text-ink-muted hover:text-ink'
          }`}
          onClick={() => onChangeTab('orders')}
        >
          My Orders
        </button>
      </div>

      {tab === 'listings' ? (
        <ListingsTab myWallet={myWallet} onVisitPost={onVisitPost} />
      ) : (
        <OrdersTab myWallet={myWallet} onOpenThread={onOpenThread} />
      )}
    </div>
  )
}
