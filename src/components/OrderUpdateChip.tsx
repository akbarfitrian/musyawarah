import { useState } from 'react'
import { timeAgo } from '../utils/time'
import { CheckIcon, FlagIcon, LinkIcon, LockIcon } from './icons'
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
  refunded: 'bg-danger/15 text-danger',
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
  onMarkDelivered,
  deliveringOrderId,
  deliverError,
  onSubmitReview,
  alreadyReviewed,
  submittingReviewOrderId,
  reviewError,
  dismissed,
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
  /** Provider klik "Mark as delivered" -- link deliverable, 015. Opsional
   * dengan alasan sama kayak onCancelOrder/onSubmitReview di bawah. */
  onMarkDelivered?: (order: Order, url: string) => void
  deliveringOrderId?: string | null
  deliverError?: { orderId: string; message: string } | null
  /** Buyer klik "Dispute" -- link hasil kerjaan dianggap belum memuaskan
   * (019/020). Cuma sekali per order (`order.dispute_used`), tombolnya
   * ilang permanen setelah dipakai walau order balik 'locked' lagi. */
  onDisputeOrder?: (order: Order, reason: string) => void
  disputingOrderId?: string | null
  disputeError?: { orderId: string; message: string } | null
  /** Provider balas dispute dengan link baru (019) -- beda dari
   * onMarkDelivered, ini nimpa deliverable_url yang sudah ada & cuma aktif
   * selama status 'disputed'. */
  onSubmitRevision?: (order: Order, url: string) => void
  revisingOrderId?: string | null
  revisionError?: { orderId: string; message: string } | null
  /** Fase 4: kirim review buat order 'released'. Opsional biar komponen ini
   * tetap kepake di tempat lain tanpa wiring review (mis. tes/storybook). */
  onSubmitReview?: (order: Order, rating: number, comment: string) => void
  /** True kalau `myWallet` udah pernah ngirim review buat order ini. */
  alreadyReviewed?: boolean
  submittingReviewOrderId?: string | null
  reviewError?: { orderId: string; message: string } | null
  /** True kalau user pernah klik "Not now" buat order ini di device ini
   * (localStorage, lihat utils/reviewDismissal.ts) -- form rating disembunyiin,
   * diganti baris kecil "Rate now" buat manggil baliknya. */
  dismissed?: boolean
  onDismissReview?: (order: Order) => void
  onUndismissReview?: (order: Order) => void
  /** Batalin order 'pending' -- buyer ATAU provider boleh (011). Opsional
   * dengan alasan sama kayak onSubmitReview di atas. */
  onCancelOrder?: (order: Order) => void
  cancellingOrderId?: string | null
  cancelError?: { orderId: string; message: string } | null
}) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [deliverableUrlInput, setDeliverableUrlInput] = useState('')
  // Checkbox "udah dicek link-nya" buat form Mark as delivered -- bukan
  // validasi backend (RPC cuma cek format http/https, gak bisa nge-cek link
  // itu beneran bisa diakses buyer atau nggak), murni nge-rem buyer/seller
  // biar mikir sebelum submit, karena setelah ini buyer cuma dapet 1x jatah
  // dispute (020) kalau ternyata link-nya salah/rusak.
  const [deliverableLinkChecked, setDeliverableLinkChecked] = useState(false)
  // Form "Dispute" -- alasan WAJIB diisi (RPC nolak string kosong), textarea
  // baru muncul begitu buyer klik tombol "Dispute" (bukan langsung nongol,
  // biar gak keliatan kayak tombol berbahaya yang gampang kepencet gak
  // sengaja).
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [disputeReasonInput, setDisputeReasonInput] = useState('')
  // Form "Submit revision" -- checkbox terpisah dari deliverableLinkChecked
  // di atas, dan SENGAJA lebih ditekankan di teks (lihat render di bawah):
  // ini kesempatan TERAKHIR seller sebelum jatah dispute buyer abis beneran
  // (020) -- kalau linknya salah lagi, buyer cuma bisa confirm atau kasih
  // rating jelek, gak ada jalan lain lewat sistem ini.
  const [revisionLinkChecked, setRevisionLinkChecked] = useState(false)
  const [revisionUrlInput, setRevisionUrlInput] = useState('')

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
  //
  // PENGECUALIAN sejak 015 (mark_order_delivered): pesan "Provider marked
  // this order as delivered." JUGA punya status 'locked' di payload-nya
  // (status order gak berubah pas delivery, cuma nambah deliverable_url).
  // Pesan yang PUNYA `deliverable_url` di payload-nya sendiri diperlakukan
  // sebagai chip TERPISAH (lihat `isDeliveryMessage` & `isCurrentDelivery`
  // di bawah) -- bukan ikut logic isCurrentStatus umum ini.
  const messageOwnDeliverableUrl = (message.payload as OrderUpdatePayload | null)?.deliverable_url ?? null
  const isCurrentStatus = Boolean(order) && messageStatus === order!.status && !messageOwnDeliverableUrl

  // Chip "Provider marked this order as delivered." itu sendiri -- di sinilah
  // (bukan lagi di chip "Escrow locked" awal) kartu link + tombol Confirm /
  // teks "waiting for buyer" ditempel, sekali render doang, gak dobel kayak
  // sebelumnya (reminder card di 2 chip sekaligus). `isCurrentDelivery` cuma
  // true selama order MASIH 'locked' (belum di-confirm) -- begitu buyer
  // confirm, order.status jadi 'completed', tombol/teks aksi ikut ilang,
  // tapi kartu linknya sendiri (`isDeliveryMessage`) tetap kepajang sebagai
  // histori permanen.
  const isDeliveryMessage = Boolean(messageOwnDeliverableUrl)
  const isCurrentDelivery = isDeliveryMessage && Boolean(order) && order!.status === 'locked'

  const isLocking = Boolean(order) && lockingOrderId === order!.id
  const isConfirming = Boolean(order) && confirmingOrderId === order!.id
  const isCancelling = Boolean(order) && cancellingOrderId === order!.id
  const isDelivering = Boolean(order) && deliveringOrderId === order!.id
  const isDisputing = Boolean(order) && disputingOrderId === order!.id
  const isRevising = Boolean(order) && revisingOrderId === order!.id

  // pending: buyer dapet tombol Lock escrow (Fase 3.2).
  const canLockEscrow = isCurrentStatus && messageStatus === 'pending' && myWallet === order!.buyer_wallet
  // pending: buyer ATAU provider bisa batalin sebelum ada dana di escrow (011).
  const canCancelOrder =
    isCurrentStatus &&
    messageStatus === 'pending' &&
    Boolean(onCancelOrder) &&
    (myWallet === order!.buyer_wallet || myWallet === order!.provider_wallet)
  // locked + udah ada deliverable_url (016): buyer dapet tombol Confirm
  // complete, ditempel di chip delivery (bukan chip "Escrow locked" lagi).
  const canConfirmComplete = isCurrentDelivery && myWallet === order!.buyer_wallet
  // locked + deliverable ada + belum pernah dispute (020, `dispute_used`):
  // buyer dapet tombol "Dispute" di sebelah Confirm. Begitu dispute_used
  // true, tombol ini ilang PERMANEN buat order ini walau statusnya balik
  // 'locked' lagi lewat revisi -- makanya guard-nya `dispute_used`, BUKAN
  // `dispute_reason` (yang di-null-kan lagi tiap revisi).
  const canDisputeOrder = isCurrentDelivery && myWallet === order!.buyer_wallet && Boolean(onDisputeOrder) && !order!.dispute_used
  // disputed: provider dapet form "Submit revision" (019) -- berlaku buat
  // KEDUA jenis dispute (manual buyer / auto-flag 017 non-delivery), RPC-nya
  // sendiri gak bedain dispute_reason, cuma syaratin status = 'disputed'.
  const canSubmitRevision =
    isCurrentStatus && messageStatus === 'disputed' && myWallet === order!.provider_wallet && Boolean(onSubmitRevision)
  // disputed: buyer nunggu balasan seller -- teks beda dari placeholder umum
  // biar jelas ini lagi nunggu ACTION seller, bukan operator.
  const showWaitingForRevision = isCurrentStatus && messageStatus === 'disputed' && myWallet === order!.buyer_wallet
  // locked + belum ada deliverable_url: buyer nunggu, teks ini tetap di chip
  // "Escrow locked" karena chip delivery belum ada sama sekali di titik ini.
  const showWaitingForDelivery =
    isCurrentStatus && messageStatus === 'locked' && myWallet === order!.buyer_wallet && !order!.deliverable_url
  const showWaitingForBuyer = isCurrentDelivery && myWallet === order!.provider_wallet
  // locked + belum ada deliverable_url: provider dapet form "Mark as
  // delivered" (015), ditempel di chip "Escrow locked" yang sama (bukan chip
  // baru), biar gak nambah 1 langkah scroll lagi.
  const canMarkDelivered =
    isCurrentStatus &&
    messageStatus === 'locked' &&
    myWallet === order!.provider_wallet &&
    Boolean(onMarkDelivered) &&
    !order!.deliverable_url
  // Kartu link deliverable -- cuma di 1 tempat sekarang: chip "Provider
  // marked this order as delivered." itu sendiri. Sebelumnya sempat dobel
  // (ada juga reminder di chip "Escrow locked" original), itu udah dicabut.
  const showDeliverableCard = isDeliveryMessage
  const deliverableUrl = messageOwnDeliverableUrl

  // Pesan "Buyer disputed the delivered work: <alasan>" (019/020) beda dari
  // chip status lain -- isinya free text (maks 1000 karakter, boleh gak ada
  // spasi sama sekali) yang gampang bikin pill `rounded-full` melar horizontal
  // dan muncul scrollbar (lihat laporan pengguna). Dipecah jadi 2 bagian
  // (label tetap + alasan) dan dirender sebagai card kiri-rata yang boleh
  // wrap ke banyak baris -- bukan pill 1-baris yang dipaksa center.
  const disputeReasonMatch = message.content.match(
    /^(Buyer disputed the delivered work(?: \(one-time dispute used\))?):\s*([\s\S]*)$/
  )

  return (
    <div className="flex flex-col items-center gap-1.5 py-1">
      {disputeReasonMatch ? (
        <div className="w-64 max-w-full rounded-xl border border-surface-border bg-surface-hover px-3 py-2.5 text-left">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
            <span className="shrink-0">
              <FlagIcon size={12} />
            </span>
            {disputeReasonMatch[1]}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-snug text-ink">
            {disputeReasonMatch[2]}
          </p>
          <span className="mt-1.5 block text-[10px] text-ink-faint">{timeAgo(message.created_at)}</span>
        </div>
      ) : (
        <span
          className={`max-w-[85%] whitespace-pre-wrap break-words rounded-full px-3 py-1 text-center text-[12px] font-medium ${
            messageStatus ? CHIP_STYLE[messageStatus] : 'bg-surface text-ink-muted'
          }`}
        >
          {message.content}
          <span className="ml-1.5 opacity-70">· {timeAgo(message.created_at)}</span>
        </span>
      )}

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

      {showDeliverableCard && deliverableUrl && (
        <a
          href={deliverableUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-56 max-w-full items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
            <LinkIcon size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-ink-muted">Deliverable</span>
            <span className="block truncate text-[12px] font-semibold text-ink">{deliverableUrl}</span>
          </span>
        </a>
      )}

      {canMarkDelivered && (
        <div className="w-56 max-w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5">
          <p className="mb-1.5 text-[11px] font-medium text-ink-muted">
            Paste a link to the finished work (Drive, GitHub, Figma, etc.)
          </p>
          <input
            type="url"
            inputMode="url"
            className="w-full rounded-lg border border-surface-border bg-base px-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-faint focus:border-brand-violet/60 focus:outline-none"
            placeholder="https://…"
            value={deliverableUrlInput}
            onChange={(e) => setDeliverableUrlInput(e.target.value)}
          />
          <label className="mt-2 flex items-start gap-1.5 text-[11px] text-ink-faint">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={deliverableLinkChecked}
              onChange={(e) => setDeliverableLinkChecked(e.target.checked)}
            />
            <span>I double-checked this link opens and shows the finished work.</span>
          </label>
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-[12px] font-semibold text-base transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            onClick={() => onMarkDelivered!(order!, deliverableUrlInput)}
            disabled={isDelivering || deliverableUrlInput.trim().length === 0 || !deliverableLinkChecked}
          >
            <LinkIcon size={12} />
            {isDelivering ? 'Saving…' : 'Mark as delivered'}
          </button>
          {order && deliverError?.orderId === order.id && (
            <p className="mt-1 text-center text-[11px] text-danger">{deliverError.message}</p>
          )}
        </div>
      )}

      {(canConfirmComplete || canDisputeOrder) && (
        <div className="flex items-center gap-2">
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
          {canDisputeOrder && !showDisputeForm && (
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-surface-border px-3 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-danger"
              onClick={() => setShowDisputeForm(true)}
            >
              <FlagIcon size={12} />
              Dispute
            </button>
          )}
        </div>
      )}

      {canDisputeOrder && showDisputeForm && (
        <div className="w-56 max-w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5">
          <p className="mb-1.5 text-[11px] font-medium text-ink-muted">
            What's wrong with the delivered work? You only get one dispute per order, so be specific.
          </p>
          <textarea
            className="w-full resize-none rounded-lg border border-surface-border bg-base px-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-faint focus:border-brand-violet/60 focus:outline-none"
            rows={3}
            maxLength={1000}
            placeholder="e.g. the file is empty, wrong format, missing the parts we agreed on…"
            value={disputeReasonInput}
            onChange={(e) => setDisputeReasonInput(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-full bg-danger px-3 py-1.5 text-[12px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              onClick={() => onDisputeOrder!(order!, disputeReasonInput.trim())}
              disabled={isDisputing || disputeReasonInput.trim().length === 0}
            >
              {isDisputing ? 'Submitting…' : 'Submit dispute'}
            </button>
            <button
              type="button"
              className="rounded-full border border-surface-border px-3 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-surface-hover"
              onClick={() => setShowDisputeForm(false)}
              disabled={isDisputing}
            >
              Cancel
            </button>
          </div>
          {order && disputeError?.orderId === order.id && (
            <p className="mt-1 text-center text-[11px] text-danger">{disputeError.message}</p>
          )}
        </div>
      )}
      {showWaitingForDelivery && (
        <p className="max-w-[85%] text-center text-[11px] text-ink-faint">
          Waiting for the provider to submit a deliverable link before you can confirm.
        </p>
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
        <div className="flex flex-col items-center gap-1">
          {order?.completion_reason === 'buyer_no_confirm_72h' && (
            <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-medium text-ink-faint">
              Auto-completed — buyer didn't confirm within 72 hours
            </span>
          )}
          <p className="max-w-[85%] text-center text-[11px] text-ink-faint">
            Waiting for a manual payout from the operator.
          </p>
        </div>
      )}

      {/* refunded (021): status terminal, paralel sama blok 'completed' di
       * atas -- histori aja, gak ada tombol lagi (refund sendiri udah
       * dieksekusi operator lewat AdminPage, lihat mark_order_refunded). */}
      {isCurrentStatus && messageStatus === 'refunded' && (
        <p className="max-w-[85%] text-center text-[11px] text-ink-faint">
          Escrowed payment refunded to the buyer by an operator.
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
        ) : dismissed ? (
          <div className="flex items-center gap-1.5 text-[11px] text-ink-faint">
            <span>Review prompt hidden.</span>
            {onUndismissReview && (
              <button
                type="button"
                className="font-semibold text-brand-violet hover:underline"
                onClick={() => onUndismissReview(order)}
              >
                Rate now
              </button>
            )}
          </div>
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
            {onDismissReview && (
              <button
                type="button"
                className="mt-1.5 w-full text-center text-[11px] text-ink-faint transition-colors hover:text-ink-muted hover:underline"
                onClick={() => onDismissReview(order)}
              >
                Not now
              </button>
            )}
            {reviewError?.orderId === order.id && (
              <p className="mt-1 text-center text-[11px] text-danger">{reviewError.message}</p>
            )}
          </div>
        ))}

      {/* disputed (019/020): provider dapet form revisi -- ini kesempatan
       * TERAKHIR dia, karena buyer cuma punya 1x jatah dispute (020) dan
       * udah kepakai buat sampai ke sini. Checkbox terpisah dari yang di
       * form "Mark as delivered" di atas, sengaja teksnya lebih tegas. */}
      {canSubmitRevision && (
        <div className="w-56 max-w-full rounded-xl border border-danger/30 bg-surface px-3 py-2.5">
          <p className="mb-1.5 text-[11px] font-medium text-danger">
            {order!.dispute_reason === 'buyer_quality_dispute'
              ? 'Buyer disputed this delivery. Submit a corrected link below.'
              : 'This order was auto-flagged for having no deliverable in time. Submit your link now.'}
          </p>
          <input
            type="url"
            inputMode="url"
            className="w-full rounded-lg border border-surface-border bg-base px-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-faint focus:border-brand-violet/60 focus:outline-none"
            placeholder="https://…"
            value={revisionUrlInput}
            onChange={(e) => setRevisionUrlInput(e.target.value)}
          />
          <label className="mt-2 flex items-start gap-1.5 text-[11px] text-ink-faint">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={revisionLinkChecked}
              onChange={(e) => setRevisionLinkChecked(e.target.checked)}
            />
            <span>
              I verified this link is correct and accessible. The buyer's dispute is already used up — after this,
              they can only confirm or leave a review.
            </span>
          </label>
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-[12px] font-semibold text-base transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            onClick={() => onSubmitRevision!(order!, revisionUrlInput)}
            disabled={isRevising || revisionUrlInput.trim().length === 0 || !revisionLinkChecked}
          >
            <LinkIcon size={12} />
            {isRevising ? 'Saving…' : 'Submit revision'}
          </button>
          {order && revisionError?.orderId === order.id && (
            <p className="mt-1 text-center text-[11px] text-danger">{revisionError.message}</p>
          )}
        </div>
      )}

      {/* disputed: buyer nunggu balasan seller (bukan lagi "operator akan
       * review manual" -- sejak 019/020 alurnya self-service, operator cuma
       * fallback kalau seller nggak pernah respons sama sekali, lihat catatan
       * di 019/020). */}
      {showWaitingForRevision && (
        <p className="max-w-[85%] text-center text-[11px] text-ink-faint">
          {order!.dispute_reason === 'buyer_quality_dispute'
            ? "You've used your one dispute for this order. Waiting for the provider to submit a corrected link."
            : 'This order was auto-flagged because the provider never submitted a deliverable. Waiting for them to respond.'}
        </p>
      )}
    </div>
  )
}
