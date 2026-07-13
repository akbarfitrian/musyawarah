import { useEffect, useRef, useState } from 'react'
import type { Post } from '../types'
import { TipButton } from './TipButton'
import { RepostButton } from './RepostButton'
import { VerifiedBadge } from './VerifiedBadge'
import { avatarColor, avatarInitial, resolveAuthorAvatar, shortenAddress } from '../utils/avatar'
import { timeAgo } from '../utils/time'
import { linkify } from '../utils/linkify'
import { useWallet } from '../contexts/WalletContext'
import { useProfile } from '../contexts/ProfileContext'
import { useVerification } from '../hooks/useVerification'
import { canEditPost, maxPostChars } from '../lib/verification'
import { supabase } from '../supabaseClient'
import { setListingActive } from '../hooks/usePosts'
import { postPath } from '../utils/routes'
import { CopyLinkButton } from './CopyLinkButton'
import { TrashIcon, RepostIcon, PencilIcon, XIcon, BriefcaseIcon, TagIcon, MessageIcon, CheckIcon } from './icons'

export function PostCard({
  post,
  onTipped,
  onDeleted,
  onVisitProfile,
  onVisitPost,
  onMessageProvider,
  highlighted,
}: {
  post: Post
  onTipped: () => void
  onDeleted: () => void
  onVisitProfile?: (walletAddress: string) => void
  /** Dipanggil pas timestamp post diklik -- buka halaman permalink-nya
   * sendiri (#/post/:id), sama kayak klik tanggal di tweet X/Twitter. */
  onVisitPost?: (postId: string) => void
  /** Dipanggil pas tombol "Nego & Hire" di kartu listing diklik -- buka DM
   * ke provider-nya. Fase 2: kalau `postId` diisi, App.tsx otomatis ngirim
   * kartu listing (`listing_ref`) sebagai pesan pertama sebelum pindah ke
   * thread-nya (lihat draft §1b/§4). Parameter kedua optional biar tombol
   * "Message" biasa di ProfilePage (yang gak tau konteks listing) tetap
   * kompatibel. */
  onMessageProvider?: (walletAddress: string, postId?: string) => void
  /** True kalau post ini yang harus di-scroll-ke dan disorot -- dipakai
   * pas masuk dari link "Trending" di RightPanel.tsx. */
  highlighted?: boolean
}) {
  const { walletAddress } = useWallet()
  const { profile: myProfile } = useProfile()
  const { tier: myTier } = useVerification()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [togglingListing, setTogglingListing] = useState(false)
  const isOwnPost = walletAddress === post.author_wallet
  // `orders.post_id` FK-nya `on delete restrict` (007_marketplace_
  // negotiation.sql:57) -- begitu listing ini pernah punya order (APAPUN
  // statusnya, termasuk yang udah 'cancelled'), delete_post() SELALU bakal
  // gagal di server. Daripada biarin orang klik Delete terus gagal sama
  // pesan generik, tombolnya diganti Deactivate/Activate di sini.
  const listingHasOrders = post.is_listing && (post.order_count ?? 0) > 0
  const avatarUrl = resolveAuthorAvatar(post.author_wallet, post.author_avatar_url, walletAddress, myProfile?.avatar_url)
  const cardRef = useRef<HTMLDivElement>(null)

  // Scroll ke post ini begitu ditandai highlighted (habis diklik dari
  // "Trending" di RightPanel.tsx). Cuma jalan sekali pas jadi true.
  useEffect(() => {
    if (highlighted) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlighted])

  // Ngedit post cuma boleh buat tier Verified Max, dan cuma buat post
  // sendiri -- lihat canEditPost() di lib/verification.ts.
  const canEdit = isOwnPost && canEditPost(myTier)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const editMaxLen = maxPostChars(myTier)

  function startEdit() {
    setEditContent(post.content)
    setEditError(null)
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
    setEditError(null)
    setEditContent(post.content)
  }

  async function saveEdit() {
    if (!walletAddress || saving) return
    const trimmed = editContent.trim()
    if (!trimmed && !post.image_url) {
      setEditError('Post can’t be empty.')
      return
    }
    setSaving(true)
    setEditError(null)
    try {
      // edit_post() di server (supabase/002_harden_writes.sql) yang nge-cek
      // ULANG tier boleh edit + batas karakter + kepemilikan post, bukan
      // cuma dicek di client kayak sebelumnya.
      const { error: updateError } = await supabase.rpc('edit_post', {
        p_wallet: walletAddress,
        p_post_id: post.id,
        p_content: trimmed,
      })

      if (updateError) throw updateError
      setIsEditing(false)
      onTipped() // re-pakai callback refresh yang sama dipakai tip/repost
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save changes. Try again.'
      setEditError(message)
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // Catatan: nggak pakai window.confirm() di sini. Musyawarah dimuat sebagai
  // Sphere Agent lewat iframe yang di-sandbox tanpa 'allow-modals', jadi
  // confirm()/alert()/prompt() native bakal di-ignore diem-diem sama browser
  // (lihat console: "Ignored call to 'confirm()'..."), dan delete jadi
  // nggak pernah ke-trigger. Solusinya: dialog konfirmasi custom di dalam app.
  async function performDelete() {
    if (!walletAddress || deleting) return
    setConfirmingDelete(false)
    setDeleting(true)
    setError(null)
    try {
      // delete_post() di server (supabase/002_harden_writes.sql) yang nge-
      // cek kepemilikan post -- direct .delete() ke tabel `posts` udah
      // dicabut haknya buat role anon/authenticated, jadi ini SEKARANG satu-
      // satunya jalan buat hapus post, bukan cuma penjaga tambahan lagi.
      const { error: deleteError } = await supabase.rpc('delete_post', {
        p_wallet: walletAddress,
        p_post_id: post.id,
      })

      if (deleteError) throw deleteError
      onDeleted()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete post. Try again.'
      setError(message)
      console.error(e)
      setDeleting(false)
    }
  }

  // Dipakai gantiin Delete pas listing ini udah punya order (lihat
  // listingHasOrders di atas) -- RPC yang sama dipakai "My Listings" di
  // MarketplacePage.tsx, cuma triggernya dari sini juga.
  async function handleToggleListing() {
    if (!walletAddress || togglingListing) return
    setTogglingListing(true)
    setError(null)
    try {
      await setListingActive(walletAddress, post.id, !post.listing_active)
      onTipped() // re-pakai callback refresh yang sama dipakai tip/repost/edit
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update listing status. Try again.'
      setError(message)
      console.error(e)
    } finally {
      setTogglingListing(false)
    }
  }

  return (
    <div
      ref={cardRef}
      id={`post-${post.id}`}
      className={`border-b border-surface-border px-4 pt-3 transition-colors hover:bg-surface/40 ${
        highlighted ? 'animate-highlight-flash rounded-2xl ring-2 ring-brand-violet/70' : ''
      }`}
    >
      {post.reposted_by_wallet && (
        <button
          type="button"
          className="mb-1.5 flex items-center gap-2 pl-8 text-[13px] font-medium text-ink-muted transition-colors hover:text-brand-cyan"
          onClick={() => onVisitProfile?.(post.reposted_by_wallet!)}
        >
          <RepostIcon size={13} />
          {post.reposted_by_wallet === walletAddress
            ? 'You reposted'
            : `${shortenAddress(post.reposted_by_wallet)} reposted`}
        </button>
      )}
      <article className="group flex gap-3 pb-3 transition-colors">
        <button
          type="button"
          className="h-11 w-11 shrink-0 overflow-hidden rounded-full text-sm font-semibold text-white transition-transform duration-150 hover:scale-105"
          style={{ background: avatarColor(post.author_wallet) }}
          onClick={() => onVisitProfile?.(post.author_wallet)}
          aria-label={`View profile ${shortenAddress(post.author_wallet)}`}
        >
          <span className="flex h-full w-full items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              avatarInitial(post.author_wallet)
            )}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="truncate font-mono text-[14px] font-semibold text-ink hover:underline"
              onClick={() => onVisitProfile?.(post.author_wallet)}
            >
              {shortenAddress(post.author_wallet)}
            </button>
            <VerifiedBadge tier={post.author_verification_tier} />
            <span className="text-ink-faint">·</span>
            {onVisitPost ? (
              <button
                type="button"
                className="shrink-0 text-[13px] text-ink-muted transition-colors hover:text-ink hover:underline"
                onClick={() => onVisitPost(post.id)}
              >
                {timeAgo(post.created_at)}
              </button>
            ) : (
              <span className="shrink-0 text-[13px] text-ink-muted">{timeAgo(post.created_at)}</span>
            )}
            {post.edited_at && <span className="shrink-0 text-[12px] text-ink-faint">· edited</span>}
            <span className="ml-auto flex items-center gap-1">
              <CopyLinkButton path={postPath(post.id)} label="Copy link to post" className="h-8 w-8" />
              {canEdit && !isEditing && (
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-brand-blue/10 hover:text-brand-blue disabled:opacity-50"
                    onClick={startEdit}
                    disabled={deleting}
                    aria-label="Edit post"
                    title="Edit post"
                  >
                    <PencilIcon size={14} />
                  </button>
                )}
                {isOwnPost && listingHasOrders ? (
                  <button
                    type="button"
                    className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50"
                    onClick={handleToggleListing}
                    disabled={togglingListing}
                    title={
                      post.listing_active
                        ? 'This listing has order history and can’t be deleted — deactivate it instead'
                        : 'Reactivate this listing'
                    }
                  >
                    {togglingListing ? '…' : post.listing_active ? 'Deactivate' : 'Activate'}
                  </button>
                ) : (
                  isOwnPost && (
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                      onClick={() => setConfirmingDelete(true)}
                      disabled={deleting}
                      aria-label="Delete post"
                      title="Delete post"
                    >
                      <TrashIcon size={15} />
                    </button>
                  )
                )}
              </span>
          </div>

          {post.is_listing && !isEditing && (
            <div className="mt-1 rounded-xl border border-gold/25 bg-gold/5 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                  <BriefcaseIcon size={14} />
                  {post.listing_title}
                </span>
                <span className="font-mono text-[13px] font-semibold tabular-nums text-gold">
                  {post.listing_price_amount} {post.listing_coin_symbol ?? 'UCT'}
                  <span className="font-sans font-normal text-ink-faint">
                    {' '}
                    / {post.listing_price_mode === 'subscription' ? 'month' : 'task'}
                  </span>
                </span>
              </div>
              {(post.listing_category || !post.listing_active || (post.completed_order_count ?? 0) > 0) && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {post.listing_category && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                      <TagIcon size={11} />
                      {post.listing_category}
                    </span>
                  )}
                  {!post.listing_active && (
                    <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-faint">
                      Inactive
                    </span>
                  )}
                  {(post.completed_order_count ?? 0) > 0 && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-muted"
                      title="Orders confirmed received or paid out"
                    >
                      <CheckIcon size={10} />
                      {post.completed_order_count} sold
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {isEditing ? (
            <div className="mt-1">
              <textarea
                value={editContent}
                maxLength={editMaxLen}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                autoFocus
                className="w-full resize-none rounded-xl border border-surface-border bg-base px-3 py-2 text-[15px] leading-normal text-ink outline-none focus:border-brand-violet/50"
              />
              {editError && <p className="mt-1 text-xs text-danger">{editError}</p>}
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xs font-medium tabular-nums text-ink-faint">
                  {editMaxLen - editContent.length}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-8 items-center gap-1 rounded-full border border-surface-border px-3 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
                    onClick={cancelEdit}
                    disabled={saving}
                  >
                    <XIcon size={12} />
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-full bg-brand-gradient px-3 text-[13px] font-semibold text-accent-contrast shadow-glow transition-transform duration-150 hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                    onClick={saveEdit}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            post.content && (
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-normal text-ink">
                {linkify(post.content)}
              </p>
            )
          )}
          {post.image_url && (
            <div className="mt-2 overflow-hidden rounded-2xl border border-surface-border">
              <img src={post.image_url} alt="" className="max-h-[420px] w-full object-cover" loading="lazy" />
            </div>
          )}
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}

          {confirmingDelete && (
            <div
              className="fixed inset-0 z-40 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
            >
              <div className="w-full max-w-sm animate-scale-in rounded-2xl border border-surface-border bg-surface-soft p-5 shadow-card">
                <p className="text-[15px] text-ink">Delete this post? This cannot be undone.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-surface-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-danger px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-50"
                    onClick={performDelete}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div
            className={`mt-2.5 flex items-center gap-6 ${
              post.is_listing ? 'max-w-md' : 'max-w-xs'
            }`}
          >
            <RepostButton
              postId={post.id}
              postAuthorWallet={post.author_wallet}
              isOwnPost={isOwnPost}
              repostTotal={post.repost_total ?? 0}
              repostedByMe={post.reposted_by_me ?? false}
              onReposted={onTipped}
            />
            <TipButton
              postId={post.id}
              toWallet={post.author_wallet}
              tipTotal={post.tip_total ?? 0}
              onTipped={onTipped}
            />
            {post.is_listing && !isOwnPost && post.listing_active && onMessageProvider && (
              <button
                type="button"
                className="ml-auto flex items-center gap-1.5 rounded-full bg-gradient-to-r from-gold to-amber-400 px-3 py-1.5 text-[13px] font-semibold text-base transition-transform duration-150 hover:scale-[1.03] active:scale-95"
                onClick={() => onMessageProvider(post.author_wallet, post.id)}
              >
                <MessageIcon size={14} />
                Negotiate & Hire
              </button>
            )}
          </div>
        </div>
      </article>
    </div>
  )
}
