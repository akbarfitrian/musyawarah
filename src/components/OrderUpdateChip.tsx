import { useState } from 'react'
import { timeAgo } from '../utils/time'
import { CheckIcon, LockIcon } from './icons'
import { RatingStars } from './RatingStars'
import type { Message, Order, OrderStatus, OrderUpdatePayload } from '../types'

// ============================================================================
// FASE 3.4 — Satu komponen buat semua status `order_update`, nyatuin kerjaan
// 3.2 (Lock escrow) & 3.3 (Confirm complete) plus nambahin status yang belum
// ada tombolnya (`completed`, `released`, `disputed`). Dipanggil dari
// MessagesPage.tsx tiap `message.kind === 'order_update'`, gak lagi if-else
// numpuk langsung di sana. Lihat tabel status di
// musyawarah-marketplace-fase-3.2-dst.md §3.4.
// ============================================================================

/** Warna chip per status -- token yang sudah ada di Tailwind config
 * (emerald/danger/dst), bukan skema baru. */
const CHIP_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-600',
  locked: 'bg-blue-500/15 text-blue-600',
  completed: 'bg-emerald-500/15 text-emerald-600',
  released: 'bg-emerald-700/15 text-emerald-700',
  disputed: 'bg-surface-hover text-ink-muted',
  cancelled: 'bg-surface-hover text-ink-faint line-through',
}

export function OrderUpdateChip({
  message,
  order,
  myWallet,
  onLockEscrow,
  lockingOrderId,
  lockError,
  onConfirmComplete,
  confirmingOrderId,
  confirmError,
  onSubmitReview,
  alreadyReviewed,
  submittingReviewOrderId,
  reviewError,
  onCancelOrder,
  cancellingOrderId,
  cancelError,
}: {
  message: Message
  order?: Order
  myWallet: string | null
  onLockEscrow: (order: Order) => void
  lockingOrderId: string | null
  lockError: { orderId: string; message: string } | null
  onConfirmComplete: (order: Order) => void
  confirmingOrderId: string | null
  confirmError: { orderId: string; message: string } | null
  /** Fase 4: kirim review buat order 'released'. Opsional biar komponen ini
   * tetap kepake di tempat lain tanpa wiring review (mis. tes/storybook). */
  onSubmitReview?: (order: Order, rating: number, comment: string) => void
  /** True kalau `myWallet` udah pernah ngirim review buat order ini. */
  alreadyReviewed?: boolean
  submittingReviewOrderId?: string | null
  reviewError?: { orderId: string; message: string } | null
  /** Batalin order 'pending' -- buyer ATAU provider boleh (011). Opsional
   * dengan alasan sama kayak onSubmitReview di atas. */
  onCancelOrder?: (order: Order) => void
  cancellingOrderId?: string | null
  cancelError?: { orderId: string; message: string } | null
}) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  // Status buat WARNA & LABEL chip: harus dibaca dari `message.payload`, yaitu
  // status yang di-snapshot SAAT pesan itu dibuat -- bukan dari `order.status`
  // (live). `order` di-refetch tiap kali order berubah, jadi kalau dipakai
  // langsung, histori lama (Order created, Escrow locked, dst) ikut kebawa
  // status terbaru begitu order lanjut ke status berikutnya. `order?.status`
  // cuma dipakai sebagai fallback buat pesan lama yang mungkin belum punya
  // payload berisi status (data pra-migrasi ini).
  const messageStatus: OrderStatus | undefined =
    (message.payload as OrderUpdatePayload | null)?.status ?? order?.status

  // Status buat AKSI (tombol/form): cuma boleh nongol di pesan yang mewakili
  // status order SAAT INI -- bukan tiap pesan yang statusnya pernah cocok.
  // Karena status order berjalan satu arah (pending -> locked -> ... ), pesan
  // dengan messageStatus === order.status yang sekarang ya cuma pesan
  // terakhir itu.
  const isCurrentStatus = Boolean(order) && messageStatus === order!.status

  const isLocking = Boolean(order) && lockingOrderId === order!.id
  const isConfirming = Boolean(order) && confirmingOrderId === order!.id
  const isCancelling = Boolean(order) && cancellingOrderId === order!.id

  // pending: buyer dapet tombol Lock escrow (Fase 3.2).
  const canLockEscrow = isCurrentStatus && messageStatus === 'pending' && myWallet === order!.buyer_wallet
  // pending: buyer ATAU provider bisa batalin sebelum ada dana di escrow (011).
  const canCancelOrder =
    isCurrentStatus &&
    messageStatus === 'pending' &&
    Boolean(onCancelOrder) &&
    (myWallet === order!.buyer_wallet || myWallet === order!.provider_wallet)
  // locked: buyer dapet tombol Confirm complete (Fase 3.3), provider cuma teks info.
  const canConfirmComplete = isCurrentStatus && messageStatus === 'locked' && myWallet === order!.buyer_wallet
  const showWaitingForBuyer = isCurrentStatus && messageStatus === 'locked' && myWallet === order!.provider_wallet

  return (
    <div className="flex flex-col items-center gap-1.5 py-1">
      <span
        className={`max-w-[85%] rounded-full px-3 py-1 text-center text-[12px] font-medium ${
          messageStatus ? CHIP_STYLE[messageStatus] : 'bg-surface text-ink-muted'
        }`}
      >
        {message.content}
        <span className="ml-1.5 opacity-70">· {timeAgo(message.created_at)}</span>
      </span>

      {canLockEscrow && (
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-gold to-amber-400 px-3.5 py-1.5 text-[12px] font-semibold text-base transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
          onClick={() => onLockEscrow(order!)}
          disabled={isLocking}
        >
          <LockIcon size={12} />
          {isLocking ? 'Locking escrow…' : 'Lock escrow'}
        </button>
      )}
      {order && lockError?.orderId === order.id && (
        <p className="max-w-[85%] text-center text-[11px] text-danger">{lockError.message}</p>
      )}

      {canCancelOrder && (
        <button
          type="button"
          className="rounded-full border border-surface-border px-3 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50"
          onClick={() => onCancelOrder!(order!)}
          disabled={isCancelling}
        >
          {isCancelling ? 'Cancelling…' : 'Cancel order'}
        </button>
      )}
      {order && cancelError?.orderId === order.id && (
        <p className="max-w-[85%] text-center text-[11px] text-danger">{cancelError.message}</p>
      )}

      {canConfirmComplete && (
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-[12px] font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
          onClick={() => onConfirmComplete(order!)}
          disabled={isConfirming}
        >
          <CheckIcon size={12} />
          {isConfirming ? 'Confirming…' : 'Confirm task complete'}
        </button>
      )}
      {showWaitingForBuyer && (
        <p className="max-w-[85%] text-center text-[11px] text-ink-faint">
          Funds locked in escrow, waiting for buyer confirmation.
        </p>
      )}
      {order && confirmError?.orderId === order.id && (
        <p className="max-w-[85%] text-center text-[11px] text-danger">{confirmError.message}</p>
      )}

      {/* completed: release tetap manual (operator, Fase 3.1) -- tanpa tombol.
       * isCurrentStatus: kalau order udah lanjut ke 'released', pesan histori
       * 'completed' ini gak boleh nampilin lagi "menunggu payout". */}
      {isCurrentStatus && messageStatus === 'completed' && (
        <p className="max-w-[85%] text-center text-[11px] text-ink-faint">
          Waiting for a manual payout from the operator.
        </p>
      )}

      {/* released: penanda "order boleh direview" -- kedua pihak (buyer &
       * provider) dapet prompt "Leave a review" (Fase 4), sekali per order.
       * isCurrentStatus disini sebetulnya selalu true kalau messageStatus
       * 'released' cocok (status terminal), tapi tetap dipasang biar
       * konsisten & aman kalau alur order berubah di masa depan. */}
      {isCurrentStatus &&
        messageStatus === 'released' &&
        order &&
        onSubmitReview &&
        (myWallet === order.buyer_wallet || myWallet === order.provider_wallet) &&
        (alreadyReviewed ? (
          <p className="max-w-[85%] text-center text-[11px] text-ink-faint">Thanks for leaving a review.</p>
        ) : (
          <div className="w-56 max-w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5">
            <p className="mb-1.5 text-center text-[11px] font-medium text-ink-muted">Leave a review</p>
            <div className="flex justify-center">
              <RatingStars value={rating} onChange={setRating} size={18} />
            </div>
            <textarea
              className="mt-2 w-full resize-none rounded-lg border border-surface-border bg-base px-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-faint focus:border-brand-violet/60 focus:outline-none"
              rows={2}
              maxLength={1000}
              placeholder="Comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button
              type="button"
              className="mt-2 w-full rounded-full bg-brand-gradient px-3 py-1.5 text-[12px] font-semibold text-accent-contrast shadow-glow transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              onClick={() => onSubmitReview(order, rating, comment)}
              disabled={rating === 0 || submittingReviewOrderId === order.id}
            >
              {submittingReviewOrderId === order.id ? 'Submitting…' : 'Submit review'}
            </button>
            {reviewError?.orderId === order.id && (
              <p className="mt-1 text-center text-[11px] text-danger">{reviewError.message}</p>
            )}
          </div>
        ))}

      {/* disputed: dispute flow belum diputusin (draft ringkas §8) --
       * placeholder teks aja, tetap tanpa UI aksi. */}
      {isCurrentStatus && messageStatus === 'disputed' && (
        <p className="max-w-[85%] text-center text-[11px] text-ink-faint">
          This order is under dispute. The operator team will review it manually.
        </p>
      )}
    </div>
  )
}
