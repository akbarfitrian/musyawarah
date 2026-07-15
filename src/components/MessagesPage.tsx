import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { useConversations, useThread, useListingSnapshots, useProviderListings } from '../hooks/useMessages'
import {
  TREASURY_WALLET,
  beginEscrowLock,
  abortEscrowLock,
  cancelOrder,
  confirmOrderComplete,
  lockEscrowOrder,
  markOrderDelivered,
  disputeOrder,
  submitDeliverableRevision,
  useOrderSnapshots,
} from '../hooks/useOrders'
import { submitReview, useMyReviewedOrderIds } from '../hooks/useReviews'
import { useViewedProfile } from '../hooks/useViewedProfile'
import { avatarColor, avatarInitial, shortenAddress } from '../utils/avatar'
import { timeAgo } from '../utils/time'
import { linkify } from '../utils/linkify'
import { messagesPath } from '../utils/routes'
import { CopyLinkButton } from './CopyLinkButton'
import { OrderUpdateChip } from './OrderUpdateChip'
import { VerifiedBadge } from './VerifiedBadge'
import type { ListingSnapshot, Message, OfferPayload, Order, OrderUpdatePayload } from '../types'
import type { VerificationTier } from '../lib/verification'
import {
  BriefcaseIcon,
  CheckIcon,
  ChevronLeftIcon,
  ComposeMessageIcon,
  MessageIcon,
  SendIcon,
  TagIcon,
  TrashIcon,
  XIcon,
} from './icons'
import { dismissReviewPrompt, isReviewPromptDismissed, undismissReviewPrompt } from '../utils/reviewDismissal'

function ConversationRow({
  wallet,
  avatarUrl,
  verificationTier,
  preview,
  timestamp,
  unread,
  onClick,
  onVisitProfile,
}: {
  wallet: string
  avatarUrl: string | null
  verificationTier?: VerificationTier
  preview: string
  timestamp: string
  unread: number
  onClick: () => void
  onVisitProfile?: (walletAddress: string) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex w-full cursor-pointer items-center gap-3 border-b border-surface-border px-4 py-3 text-left transition-colors hover:bg-surface/60"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <button
        type="button"
        className="h-11 w-11 shrink-0 overflow-hidden rounded-full text-sm font-semibold text-white transition-transform duration-150 hover:scale-105"
        style={{ background: avatarColor(wallet) }}
        onClick={(e) => {
          e.stopPropagation()
          onVisitProfile?.(wallet)
        }}
        aria-label={`View profile ${shortenAddress(wallet)}`}
      >
        <span className="flex h-full w-full items-center justify-center">
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : avatarInitial(wallet)}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={`truncate font-mono text-[14px] text-ink hover:underline ${unread > 0 ? 'font-bold' : 'font-semibold'}`}
            onClick={(e) => {
              e.stopPropagation()
              onVisitProfile?.(wallet)
            }}
          >
            {shortenAddress(wallet)}
          </button>
          <VerifiedBadge tier={verificationTier} size={13} />
          <span className="text-ink-faint">·</span>
          <span className="shrink-0 text-[12px] text-ink-muted">{timeAgo(timestamp)}</span>
        </div>
        <p className={`truncate text-[13px] ${unread > 0 ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
          {preview}
        </p>
      </div>
      {unread > 0 && (
        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-notify px-1.5 text-[11px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </div>
  )
}

function NewMessageForm({ onStart, onCancel }: { onStart: (wallet: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('')

  return (
    <div className="border-b border-surface-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-ink">New message</span>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
          onClick={onCancel}
          aria-label="Cancel"
        >
          <XIcon size={14} />
        </button>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Wallet address or @handle"
          className="w-full rounded-full border border-surface-border bg-base px-4 py-2 font-mono text-[13px] text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-brand-violet/60 focus:shadow-glow focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onStart(value.trim())
          }}
          autoFocus
        />
        <button
          type="button"
          className="shrink-0 rounded-full bg-brand-gradient px-4 py-2 text-[13px] font-semibold text-accent-contrast shadow-glow transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
          disabled={!value.trim()}
          onClick={() => onStart(value.trim())}
        >
          Chat
        </button>
      </div>
    </div>
  )
}

function ListingMiniCard({
  listing,
  onVisitPost,
}: {
  listing: ListingSnapshot | undefined
  onVisitPost?: (postId: string) => void
}) {
  if (!listing) {
    return <p className="text-[12px] italic text-ink-faint">Listing unavailable (may have been removed).</p>
  }
  return (
    <button
      type="button"
      className="w-full rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-left transition-colors hover:bg-gold/10"
      onClick={() => onVisitPost?.(listing.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-semibold text-ink">
          <BriefcaseIcon size={13} />
          <span className="truncate">{listing.listing_title}</span>
        </span>
        <span className="shrink-0 font-mono text-[12px] font-semibold text-gold">
          {listing.listing_price_amount} {listing.listing_coin_symbol ?? 'UCT'}
        </span>
      </div>
      {listing.listing_category && (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-muted">
          <TagIcon size={10} />
          {listing.listing_category}
        </span>
      )}
      {!listing.listing_active && (
        <span className="ml-1.5 inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-faint">
          Inactive
        </span>
      )}
    </button>
  )
}

function MessageBubble({
  message,
  isMine,
  listing,
  order,
  myWallet,
  onVisitPost,
  onAccept,
  onDecline,
  actionPending,
  onLockEscrow,
  lockingOrderId,
  lockError,
  onConfirmComplete,
  confirmingOrderId,
  confirmError,
  onMarkDelivered,
  deliveringOrderId,
  deliverError,
  onSubmitReview,
  alreadyReviewed,
  submittingReviewOrderId,
  reviewError,
  dismissedReview,
  onDismissReview,
  onUndismissReview,
  onCancelOrder,
  cancellingOrderId,
  cancelError,
  onDisputeOrder,
  disputingOrderId,
  disputeError,
  onSubmitRevision,
  revisingOrderId,
  revisionError,
  onDeleteMessage,
  deletingMessageId,
}: {
  message: Message
  isMine: boolean
  listing: ListingSnapshot | undefined
  order?: Order
  myWallet: string | null
  onVisitPost?: (postId: string) => void
  onAccept: (messageId: string) => void
  onDecline: (messageId: string) => void
  actionPending: boolean
  onLockEscrow: (order: Order) => void
  lockingOrderId: string | null
  lockError: { orderId: string; message: string } | null
  onConfirmComplete: (order: Order) => void
  confirmingOrderId: string | null
  confirmError: { orderId: string; message: string } | null
  onMarkDelivered: (order: Order, url: string) => void
  deliveringOrderId: string | null
  deliverError: { orderId: string; message: string } | null
  onSubmitReview: (order: Order, rating: number, comment: string) => void
  alreadyReviewed: boolean
  submittingReviewOrderId: string | null
  reviewError: { orderId: string; message: string } | null
  dismissedReview: boolean
  onDismissReview: (order: Order) => void
  onUndismissReview: (order: Order) => void
  onCancelOrder: (order: Order) => void
  cancellingOrderId: string | null
  cancelError: { orderId: string; message: string } | null
  onDisputeOrder: (order: Order, reason: string) => void
  disputingOrderId: string | null
  disputeError: { orderId: string; message: string } | null
  onSubmitRevision: (order: Order, url: string) => void
  revisingOrderId: string | null
  revisionError: { orderId: string; message: string } | null
  onDeleteMessage?: (messageId: string) => void
  deletingMessageId?: string | null
}) {
  if (message.kind === 'order_update') {
    return (
      <OrderUpdateChip
        message={message}
        order={order}
        myWallet={myWallet}
        onLockEscrow={onLockEscrow}
        lockingOrderId={lockingOrderId}
        lockError={lockError}
        onConfirmComplete={onConfirmComplete}
        confirmingOrderId={confirmingOrderId}
        confirmError={confirmError}
        onMarkDelivered={onMarkDelivered}
        deliveringOrderId={deliveringOrderId}
        deliverError={deliverError}
        onSubmitReview={onSubmitReview}
        alreadyReviewed={alreadyReviewed}
        submittingReviewOrderId={submittingReviewOrderId}
        reviewError={reviewError}
        dismissed={dismissedReview}
        onDismissReview={onDismissReview}
        onUndismissReview={onUndismissReview}
        onCancelOrder={onCancelOrder}
        cancellingOrderId={cancellingOrderId}
        cancelError={cancelError}
        onDisputeOrder={onDisputeOrder}
        disputingOrderId={disputingOrderId}
        disputeError={disputeError}
        onSubmitRevision={onSubmitRevision}
        revisingOrderId={revisingOrderId}
        revisionError={revisionError}
      />
    )
  }

  const bubbleShell = (children: ReactNode) => (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug ${
          isMine
            ? 'rounded-br-md bg-brand-gradient text-accent-contrast'
            : 'rounded-bl-md border border-surface-border bg-surface text-ink'
        }`}
      >
        {children}
      </div>
    </div>
  )

  if (message.kind === 'listing_ref') {
    return bubbleShell(
      <div className="w-64 max-w-full">
        <ListingMiniCard listing={listing} onVisitPost={onVisitPost} />
        <span className={`mt-1 block text-[10px] ${isMine ? 'text-accent-contrast/70' : 'text-ink-faint'}`}>
          {timeAgo(message.created_at)}
        </span>
      </div>
    )
  }

  if (message.kind === 'offer') {
    const payload = message.payload as OfferPayload
    const canRespond = !isMine && payload.status === 'pending'
    return bubbleShell(
      <div className="w-64 max-w-full">
        <div className="mb-1.5">
          <ListingMiniCard listing={listing} onVisitPost={onVisitPost} />
        </div>
        <p className="whitespace-pre-wrap break-words">{linkify(message.content)}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              payload.status === 'accepted'
                ? 'bg-emerald-500/15 text-emerald-500'
                : payload.status === 'declined'
                  ? 'bg-danger/15 text-danger'
                  : isMine
                    ? 'bg-white/15 text-accent-contrast'
                    : 'bg-surface-hover text-ink-muted'
            }`}
          >
            {payload.status === 'pending' ? 'Pending' : payload.status === 'accepted' ? 'Accepted' : 'Declined'}
          </span>
          <span className={`text-[10px] ${isMine ? 'text-accent-contrast/70' : 'text-ink-faint'}`}>
            {timeAgo(message.created_at)}
          </span>
        </div>
        {canRespond && (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
              onClick={() => onAccept(message.id)}
              disabled={actionPending}
            >
              <CheckIcon size={12} />
              Accept
            </button>
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 rounded-full border border-surface-border bg-base px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-hover disabled:opacity-50"
              onClick={() => onDecline(message.id)}
              disabled={actionPending}
            >
              <XIcon size={11} />
              Decline
            </button>
          </div>
        )}
      </div>
    )
  }

  if (message.deleted) {
    return bubbleShell(
      <span className={`italic ${isMine ? 'text-accent-contrast/70' : 'text-ink-faint'}`}>
        This message was deleted
        <span className={`ml-2 text-[10px] not-italic ${isMine ? 'text-accent-contrast/70' : 'text-ink-faint'}`}>
          {timeAgo(message.created_at)}
        </span>
      </span>
    )
  }

  return (
    <div className={`group flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
      {isMine && onDeleteMessage && (
        <button
          type="button"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-faint opacity-0 transition-opacity hover:bg-surface-hover hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
          onClick={() => {
            if (window.confirm('Delete this message? This cannot be undone.')) onDeleteMessage(message.id)
          }}
          disabled={deletingMessageId === message.id}
          aria-label="Delete message"
        >
          <TrashIcon size={13} />
        </button>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug ${
          isMine
            ? 'rounded-br-md bg-brand-gradient text-accent-contrast'
            : 'rounded-bl-md border border-surface-border bg-surface text-ink'
        }`}
      >
        <span className="whitespace-pre-wrap break-words">{linkify(message.content)}</span>
        <span className={`ml-2 text-[10px] ${isMine ? 'text-accent-contrast/70' : 'text-ink-faint'}`}>
          {timeAgo(message.created_at)}
        </span>
      </div>
    </div>
  )
}

function ListingSelector({
  listings,
  selectedId,
  onChange,
}: {
  listings: ListingSnapshot[]
  selectedId: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 pt-2.5">
      <span className="shrink-0 text-[11px] font-medium text-ink-faint">For listing</span>
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-surface-border bg-base px-2 py-1.5 text-[12px] text-ink outline-none focus:border-gold/60"
      >
        {listings.map((l) => (
          <option key={l.id} value={l.id}>
            {l.listing_title} — {l.listing_price_amount} {l.listing_coin_symbol ?? 'UCT'}
          </option>
        ))}
      </select>
    </div>
  )
}

function OfferForm({
  listing,
  onSend,
  onCancel,
  sending,
}: {
  listing: ListingSnapshot
  onSend: (amount: number, coinSymbol: string) => void
  onCancel: () => void
  sending: boolean
}) {
  const [amount, setAmount] = useState(String(listing.listing_price_amount ?? ''))
  const coinSymbol = listing.listing_coin_symbol ?? 'UCT'
  const parsed = Number(amount)
  const valid = amount.trim() !== '' && Number.isFinite(parsed) && parsed > 0

  return (
    <div className="px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="truncate text-[12px] font-medium text-ink-muted">
          Offer for <span className="font-semibold text-ink">{listing.listing_title}</span>
        </span>
        <button type="button" className="text-ink-faint hover:text-ink" onClick={onCancel} aria-label="Cancel offer">
          <XIcon size={13} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          autoFocus
          className="w-full rounded-full border border-surface-border bg-base px-4 py-2 font-mono text-[13px] text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-brand-violet/60 focus:outline-none"
        />
        <span className="shrink-0 text-[13px] font-medium text-ink-muted">{coinSymbol}</span>
        <button
          type="button"
          className="shrink-0 rounded-full bg-gradient-to-r from-gold to-amber-400 px-4 py-2 text-[13px] font-semibold text-base transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
          disabled={!valid || sending}
          onClick={() => valid && onSend(parsed, coinSymbol)}
        >
          Send
        </button>
      </div>
    </div>
  )
}

function ThreadView({
  otherWallet,
  onBack,
  onVisitProfile,
  onVisitPost,
}: {
  otherWallet: string
  onBack: () => void
  onVisitProfile?: (walletAddress: string) => void
  onVisitPost?: (postId: string) => void
}) {
  const { walletAddress: myWallet, sendTip } = useWallet()
  const { messages, loading, error, sending, refresh, sendMessage, sendOffer, acceptOffer, declineOffer, deleteMessage } =
    useThread(otherWallet)
  const listingSnapshots = useListingSnapshots(messages)
  const orderSnapshots = useOrderSnapshots(messages)
  const releasedOrderIds = Object.values(orderSnapshots)
    .filter((o) => o.status === 'released')
    .map((o) => o.id)
  const reviewedOrderIds = useMyReviewedOrderIds(releasedOrderIds, myWallet)
  const { profile: otherProfile, verificationTier: otherVerificationTier } = useViewedProfile(otherWallet)
  const { listings: offerableListings } = useProviderListings(otherWallet)
  const [draft, setDraft] = useState('')
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [selectedOfferListingId, setSelectedOfferListingId] = useState<string | null>(null)
  const [actingOnId, setActingOnId] = useState<string | null>(null)
  const [lockingOrderId, setLockingOrderId] = useState<string | null>(null)
  const [lockError, setLockError] = useState<{ orderId: string; message: string } | null>(null)
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<{ orderId: string; message: string } | null>(null)
  const [deliveringOrderId, setDeliveringOrderId] = useState<string | null>(null)
  const [deliverError, setDeliverError] = useState<{ orderId: string; message: string } | null>(null)
  const [submittingReviewOrderId, setSubmittingReviewOrderId] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<{ orderId: string; message: string } | null>(null)
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<{ orderId: string; message: string } | null>(null)
  const [disputingOrderId, setDisputingOrderId] = useState<string | null>(null)
  const [disputeError, setDisputeError] = useState<{ orderId: string; message: string } | null>(null)
  const [revisingOrderId, setRevisingOrderId] = useState<string | null>(null)
  const [revisionError, setRevisionError] = useState<{ orderId: string; message: string } | null>(null)
  const [locallyReviewedIds, setLocallyReviewedIds] = useState<Set<string>>(new Set())
  const [dismissedReviewIds, setDismissedReviewIds] = useState<Set<string>>(new Set())
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (loading) return
    // Wait a frame so images/avatars/order chips finish laying out before we pin to bottom,
    // otherwise the scroll can land short of the true last message.
    const raf = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    })
    return () => cancelAnimationFrame(raf)
  }, [loading, messages.length, otherWallet])

  useEffect(() => {
    if (!myWallet || releasedOrderIds.length === 0) return
    setDismissedReviewIds((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const id of releasedOrderIds) {
        if (!next.has(id) && isReviewPromptDismissed(myWallet, id)) {
          next.add(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [myWallet, releasedOrderIds.join(',')])

  useEffect(() => {
    setShowOfferForm(false)
    setSelectedOfferListingId(null)
  }, [otherWallet])

  const lastListingMessage = [...messages].reverse().find((m) => m.kind === 'listing_ref' || m.kind === 'offer')
  const lastListingPostId = lastListingMessage
    ? ((lastListingMessage.payload as { post_id: string }).post_id)
    : undefined
  const referencedListing = lastListingPostId ? listingSnapshots[lastListingPostId] : undefined
  const referencedListingIsActive = referencedListing?.listing_active === true

  const offerCandidates: ListingSnapshot[] = [
    ...(referencedListingIsActive && referencedListing ? [referencedListing] : []),
    ...offerableListings.filter((l) => l.id !== referencedListing?.id),
  ]
  const defaultOfferListing = offerCandidates[0]
  const currentOfferListing =
    offerCandidates.find((l) => l.id === selectedOfferListingId) ?? defaultOfferListing

  async function handleSend() {
    const trimmed = draft.trim()
    if (!trimmed || sending) return
    setDraft('')
    try {
      await sendMessage(trimmed)
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal ngirim pesan:', e)
      setDraft(trimmed)
    }
  }

  async function handleSendOffer(amount: number, coinSymbol: string) {
    if (!currentOfferListing) return
    try {
      await sendOffer(currentOfferListing.id, amount, coinSymbol)
      setShowOfferForm(false)
      setSelectedOfferListingId(null)
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal ngirim tawaran:', e)
    }
  }

  function openOfferForm() {
    setSelectedOfferListingId(defaultOfferListing?.id ?? null)
    setShowOfferForm(true)
  }

  function closeOfferForm() {
    setShowOfferForm(false)
    setSelectedOfferListingId(null)
  }

  async function handleAccept(messageId: string) {
    setActingOnId(messageId)
    try {
      await acceptOffer(messageId)
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal nerima tawaran:', e)
    } finally {
      setActingOnId(null)
    }
  }

  async function handleDecline(messageId: string) {
    setActingOnId(messageId)
    try {
      await declineOffer(messageId)
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal nolak tawaran:', e)
    } finally {
      setActingOnId(null)
    }
  }

  async function handleLockEscrow(order: Order) {
    if (!myWallet) return
    setLockError(null)
    if (!TREASURY_WALLET) {
      setLockError({
        orderId: order.id,
        message: 'Escrow is not configured yet (VITE_VERIFICATION_TREASURY_WALLET is empty).',
      })
      return
    }
    setLockingOrderId(order.id)
    try {
      await beginEscrowLock(order.id, myWallet)
      await refresh()

      let txHash: string | null = null
      try {
        const tip = await sendTip(TREASURY_WALLET, order.amount)
        txHash = tip.txHash
      } catch (tipError) {
        try {
          await abortEscrowLock(order.id, myWallet)
          await refresh()
        } catch (abortError) {
          console.error(
            '[MUSYAWARAH] Gagal abort reservasi escrow -- bakal ke-cover auto_revert_stale_escrow_locks dalam <=20 menit:',
            abortError
          )
        }
        throw tipError
      }
      const safeTxHash = txHash ?? `client-${Date.now()}`
      await lockEscrowOrder(order.id, myWallet, safeTxHash)
      await refresh()
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal lock escrow:', e)
      const message = e instanceof Error ? e.message : 'Failed to lock escrow. Try again.'
      setLockError({ orderId: order.id, message })
    } finally {
      setLockingOrderId(null)
    }
  }

  async function handleConfirmComplete(order: Order) {
    if (!myWallet) return
    setConfirmError(null)
    setConfirmingOrderId(order.id)
    try {
      await confirmOrderComplete(order.id, myWallet)
      await refresh()
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal konfirmasi task complete:', e)
      const message = e instanceof Error ? e.message : 'Failed to confirm. Try again.'
      setConfirmError({ orderId: order.id, message })
    } finally {
      setConfirmingOrderId(null)
    }
  }

  async function handleMarkDelivered(order: Order, url: string) {
    if (!myWallet) return
    setDeliverError(null)
    setDeliveringOrderId(order.id)
    try {
      await markOrderDelivered(order.id, myWallet, url.trim())
      await refresh()
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal menandai order sebagai delivered:', e)
      const message = e instanceof Error ? e.message : 'Failed to save deliverable link. Try again.'
      setDeliverError({ orderId: order.id, message })
    } finally {
      setDeliveringOrderId(null)
    }
  }

  async function handleCancelOrder(order: Order) {
    if (!myWallet) return
    setCancelError(null)
    setCancellingOrderId(order.id)
    try {
      await cancelOrder(order.id, myWallet)
      await refresh()
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal membatalkan order:', e)
      const message = e instanceof Error ? e.message : 'Failed to cancel order. Try again.'
      setCancelError({ orderId: order.id, message })
    } finally {
      setCancellingOrderId(null)
    }
  }

  async function handleDisputeOrder(order: Order, reason: string) {
    if (!myWallet) return
    setDisputeError(null)
    setDisputingOrderId(order.id)
    try {
      await disputeOrder(order.id, myWallet, reason)
      await refresh()
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal mengajukan dispute:', e)
      const message = e instanceof Error ? e.message : 'Failed to submit dispute. Try again.'
      setDisputeError({ orderId: order.id, message })
    } finally {
      setDisputingOrderId(null)
    }
  }

  async function handleSubmitRevision(order: Order, url: string) {
    if (!myWallet) return
    setRevisionError(null)
    setRevisingOrderId(order.id)
    try {
      await submitDeliverableRevision(order.id, myWallet, url.trim())
      await refresh()
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal mengirim revisi deliverable:', e)
      const message = e instanceof Error ? e.message : 'Failed to submit revision. Try again.'
      setRevisionError({ orderId: order.id, message })
    } finally {
      setRevisingOrderId(null)
    }
  }

  async function handleSubmitReview(order: Order, rating: number, comment: string) {
    if (!myWallet || rating < 1) return
    setReviewError(null)
    setSubmittingReviewOrderId(order.id)
    try {
      await submitReview(order.id, myWallet, rating, comment)
      setLocallyReviewedIds((prev) => new Set(prev).add(order.id))
      await refresh()
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal mengirim review:', e)
      const message = e instanceof Error ? e.message : 'Failed to submit review. Try again.'
      setReviewError({ orderId: order.id, message })
    } finally {
      setSubmittingReviewOrderId(null)
    }
  }

  function handleDismissReview(order: Order) {
    if (!myWallet) return
    dismissReviewPrompt(myWallet, order.id)
    setDismissedReviewIds((prev) => new Set(prev).add(order.id))
  }

  function handleUndismissReview(order: Order) {
    if (!myWallet) return
    undismissReviewPrompt(myWallet, order.id)
    setDismissedReviewIds((prev) => {
      const next = new Set(prev)
      next.delete(order.id)
      return next
    })
  }

  async function handleDeleteMessage(messageId: string) {
    setDeletingMessageId(messageId)
    try {
      await deleteMessage(messageId)
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal menghapus pesan:', e)
    } finally {
      setDeletingMessageId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          onClick={onBack}
          aria-label="Back to messages"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <button
          type="button"
          className="h-9 w-9 shrink-0 overflow-hidden rounded-full text-xs font-semibold text-white transition-transform duration-150 hover:scale-105"
          style={{ background: avatarColor(otherWallet) }}
          onClick={() => onVisitProfile?.(otherWallet)}
          aria-label={`View profile ${shortenAddress(otherWallet)}`}
        >
          <span className="flex h-full w-full items-center justify-center">
            {otherProfile?.avatar_url ? (
              <img src={otherProfile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              avatarInitial(otherWallet)
            )}
          </span>
        </button>
        <button
          type="button"
          className="truncate font-mono text-[15px] font-semibold text-ink hover:underline"
          onClick={() => onVisitProfile?.(otherWallet)}
        >
          {shortenAddress(otherWallet)}
        </button>
        <VerifiedBadge tier={otherVerificationTier} size={15} />
        <CopyLinkButton
          path={messagesPath(otherWallet)}
          label="Copy link to this conversation"
          className="ml-auto h-8 w-8"
        />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="py-8 text-center text-[13px] text-ink-muted">Loading conversation…</p>
        ) : error ? (
          <p className="py-8 text-center text-[13px] text-danger">{error}</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-muted">
            No messages yet. Say hi to {shortenAddress(otherWallet)}.
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_wallet === myWallet
            const postId = (m.payload as { post_id?: string } | null)?.post_id
            const orderId = (m.payload as OrderUpdatePayload | null)?.order_id
            return (
              <MessageBubble
                key={m.id}
                message={m}
                isMine={isMine}
                listing={postId ? listingSnapshots[postId] : undefined}
                order={orderId ? orderSnapshots[orderId] : undefined}
                myWallet={myWallet}
                onVisitPost={onVisitPost}
                onAccept={handleAccept}
                onDecline={handleDecline}
                actionPending={actingOnId === m.id}
                onLockEscrow={handleLockEscrow}
                lockingOrderId={lockingOrderId}
                lockError={lockError}
                onConfirmComplete={handleConfirmComplete}
                confirmingOrderId={confirmingOrderId}
                confirmError={confirmError}
                onMarkDelivered={handleMarkDelivered}
                deliveringOrderId={deliveringOrderId}
                deliverError={deliverError}
                onSubmitReview={handleSubmitReview}
                alreadyReviewed={Boolean(orderId) && (reviewedOrderIds.has(orderId!) || locallyReviewedIds.has(orderId!))}
                submittingReviewOrderId={submittingReviewOrderId}
                reviewError={reviewError}
                dismissedReview={Boolean(orderId) && dismissedReviewIds.has(orderId!)}
                onDismissReview={handleDismissReview}
                onUndismissReview={handleUndismissReview}
                onCancelOrder={handleCancelOrder}
                cancellingOrderId={cancellingOrderId}
                cancelError={cancelError}
                onDisputeOrder={handleDisputeOrder}
                disputingOrderId={disputingOrderId}
                disputeError={disputeError}
                onSubmitRevision={handleSubmitRevision}
                revisingOrderId={revisingOrderId}
                revisionError={revisionError}
                onDeleteMessage={handleDeleteMessage}
                deletingMessageId={deletingMessageId}
              />
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {showOfferForm && currentOfferListing && (
        <div className="border-t border-surface-border bg-surface/60">
          {offerCandidates.length > 1 && (
            <ListingSelector
              listings={offerCandidates}
              selectedId={currentOfferListing.id}
              onChange={setSelectedOfferListingId}
            />
          )}
          <OfferForm
            key={currentOfferListing.id}
            listing={currentOfferListing}
            onSend={handleSendOffer}
            onCancel={closeOfferForm}
            sending={sending}
          />
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-surface-border p-3">
        {offerCandidates.length > 0 && !showOfferForm && (
          <button
            type="button"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-gold to-amber-400 px-3.5 text-[13px] font-semibold text-base transition-transform hover:scale-[1.03] active:scale-95"
            onClick={openOfferForm}
            title={
              offerCandidates.length > 1
                ? 'Make an offer — choose which listing'
                : 'Make an offer for this listing'
            }
          >
            <BriefcaseIcon size={14} />
            Make offer
          </button>
        )}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          maxLength={1000}
          className="w-full rounded-full border border-surface-border bg-base px-4 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-brand-violet/60 focus:shadow-glow focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
        />
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-accent-contrast shadow-glow transition-transform hover:scale-[1.05] active:scale-95 disabled:opacity-50"
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          aria-label="Send message"
        >
          <SendIcon size={16} />
        </button>
      </div>
    </div>
  )
}

export function MessagesPage({
  openWallet,
  onOpenThread,
  onCloseThread,
  onVisitProfile,
  onVisitPost,
}: {
  openWallet?: string | null
  onOpenThread: (wallet: string) => void
  onCloseThread: () => void
  onVisitProfile?: (walletAddress: string) => void
  onVisitPost?: (postId: string) => void
}) {
  const { walletAddress: myWallet, isAutoConnecting, connecting, connect } = useWallet()
  const { conversations, loading, error, refresh } = useConversations()
  const [showNewMessage, setShowNewMessage] = useState(false)

  function openThread(wallet: string) {
    setShowNewMessage(false)
    onOpenThread(wallet)
  }

  function backToList() {
    onCloseThread()
    refresh()
  }

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
        <p className="text-sm text-ink-muted">Connect your wallet to see your messages.</p>
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

  if (openWallet) {
    return (
      <div className="h-[calc(100vh-56px)] md:h-[calc(100vh-57px)]">
        <ThreadView
          key={openWallet}
          otherWallet={openWallet}
          onBack={backToList}
          onVisitProfile={onVisitProfile}
          onVisitPost={onVisitPost}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[13px] font-medium text-ink-faint">
          {conversations.length === 0 ? 'No conversations yet' : `${conversations.length} conversation${conversations.length === 1 ? '' : 's'}`}
        </span>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-brand-violet transition-colors hover:bg-brand-violet/10"
          onClick={() => setShowNewMessage((v) => !v)}
          aria-label="New message"
          title="New message"
        >
          <ComposeMessageIcon size={19} />
        </button>
      </div>

      {showNewMessage && (
        <NewMessageForm onStart={openThread} onCancel={() => setShowNewMessage(false)} />
      )}

      {loading ? (
        <p className="py-16 text-center text-[13px] text-ink-muted">Loading messages…</p>
      ) : error ? (
        <p className="py-16 text-center text-[13px] text-danger">{error}</p>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-ink-faint">
            <MessageIcon size={26} />
          </div>
          <p className="max-w-[240px] text-[13px] text-ink-muted">
            No messages yet. Start a conversation with any wallet address.
          </p>
        </div>
      ) : (
        conversations.map((c) => (
          <ConversationRow
            key={c.wallet_address}
            wallet={c.wallet_address}
            avatarUrl={c.avatar_url}
            verificationTier={c.verification_tier}
            preview={c.last_message.sender_wallet === myWallet ? `You: ${c.last_message.content}` : c.last_message.content}
            timestamp={c.last_message.created_at}
            unread={c.unread_count}
            onClick={() => openThread(c.wallet_address)}
            onVisitProfile={onVisitProfile}
          />
        ))
      )}
    </div>
  )
}
