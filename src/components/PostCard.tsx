import { useEffect, useRef, useState } from 'react'
import type { Post } from '../types'
import { TipButton } from './TipButton'
import { RepostButton } from './RepostButton'
import { LikeButton } from './LikeButton'
import { VerifiedBadge } from './VerifiedBadge'
import { avatarColor, avatarInitial, resolveAuthorAvatar, shortenAddress } from '../utils/avatar'
import { timeAgo } from '../utils/time'
import { linkify } from '../utils/linkify'
import { useWallet } from '../contexts/WalletContext'
import { useProfile } from '../contexts/ProfileContext'
import { useVerification } from '../hooks/useVerification'
import { canEditPost, maxPostChars, tierAccent, withAlpha } from '../lib/verification'
import { supabase } from '../supabaseClient'
import { setListingActive } from '../hooks/usePosts'
import { postPath } from '../utils/routes'
import { PostOptionsMenu } from './PostOptionsMenu'
import { TrashIcon, RepostIcon, PencilIcon, XIcon, BriefcaseIcon, MessageIcon, CheckIcon } from './icons'

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
  onVisitPost?: (postId: string) => void
  onMessageProvider?: (walletAddress: string, postId?: string) => void
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
  const listingHasOrders = post.is_listing && (post.order_count ?? 0) > 0
  const avatarUrl = resolveAuthorAvatar(post.author_wallet, post.author_avatar_url, walletAddress, myProfile?.avatar_url)
  const displayName = isOwnPost ? myProfile?.name ?? post.author_name : post.author_name
  const accent = tierAccent(post.author_verification_tier)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (highlighted) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlighted])

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
      const { error: updateError } = await supabase.rpc('edit_post', {
        p_wallet: walletAddress,
        p_post_id: post.id,
        p_content: trimmed,
      })

      if (updateError) throw updateError
      setIsEditing(false)
      onTipped()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save changes. Try again.'
      setEditError(message)
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function performDelete() {
    if (!walletAddress || deleting) return
    setConfirmingDelete(false)
    setDeleting(true)
    setError(null)
    try {
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

  async function handleToggleListing() {
    if (!walletAddress || togglingListing) return
    setTogglingListing(true)
    setError(null)
    try {
      await setListingActive(walletAddress, post.id, !post.listing_active)
      onTipped()
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
          <div className="flex min-w-0 items-center gap-1.5">
            {displayName ? (
              <button
                type="button"
                className="truncate text-[14px] font-semibold text-ink hover:underline"
                onClick={() => onVisitProfile?.(post.author_wallet)}
              >
                {displayName}
              </button>
            ) : (
              <button
                type="button"
                className="truncate font-mono text-[14px] font-semibold text-ink hover:underline"
                onClick={() => onVisitProfile?.(post.author_wallet)}
              >
                {shortenAddress(post.author_wallet)}
              </button>
            )}
            <VerifiedBadge tier={post.author_verification_tier} />
            {displayName && (
              <button
                type="button"
                className="truncate font-mono text-[13px] text-ink-muted hover:underline"
                onClick={() => onVisitProfile?.(post.author_wallet)}
              >
                {shortenAddress(post.author_wallet)}
              </button>
            )}
            <span className="shrink-0 text-ink-faint">·</span>
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
              <PostOptionsMenu path={postPath(post.id)} className="h-8 w-8" />
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

          {isEditing ? null : (
            post.content && (
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-normal text-ink">
                {linkify(post.content)}
              </p>
            )
          )}

          {post.is_listing && !isEditing && (
            <div
              className="mt-2 overflow-hidden rounded-2xl border"
              style={{ borderColor: withAlpha(accent.base, 0.25), backgroundColor: withAlpha(accent.base, 0.05) }}
            >
              <div
                className={`flex items-start justify-between gap-3 px-3.5 pt-3 ${
                  !post.listing_active || (post.completed_order_count ?? 0) > 0 ? '' : 'pb-3.5'
                }`}
              >

                <div className="min-w-0">
                  <span
                    className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: withAlpha(accent.base, 0.8) }}
                  >
                    <BriefcaseIcon size={12} />
                    Listing
                    {post.listing_category && (
                      <>
                        <span style={{ color: withAlpha(accent.base, 0.3) }}>·</span>
                        <span className="normal-case tracking-normal text-ink-faint">{post.listing_category}</span>
                      </>
                    )}
                  </span>
                  <h3 className="mt-1 truncate text-[15px] font-bold leading-snug text-ink">
                    {post.listing_title}
                  </h3>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className="font-mono text-[17px] font-bold leading-tight tabular-nums"
                    style={{ color: accent.base }}
                  >
                    {post.listing_price_amount} {post.listing_coin_symbol ?? 'UCT'}
                  </div>
                  <div className="text-[11px] font-medium text-ink-faint">
                    / {post.listing_price_mode === 'subscription' ? 'month' : 'task'}
                  </div>
                </div>
              </div>

              {(!post.listing_active || (post.completed_order_count ?? 0) > 0) && (
                <div
                  className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t px-3.5 py-2"
                  style={{ borderColor: withAlpha(accent.base, 0.1) }}
                >
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
          ) : null}
          {post.image_url && (
            <div className="mt-2 overflow-hidden rounded-2xl border border-surface-border bg-surface-soft">
              <img src={post.image_url} alt="" className="max-h-[420px] w-full object-contain" loading="lazy" />
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

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="-ml-2 flex items-center gap-1">
              <TipButton
                postId={post.id}
                toWallet={post.author_wallet}
                tipTotal={post.tip_total ?? 0}
                onTipped={onTipped}
              />
              <RepostButton
                postId={post.id}
                postAuthorWallet={post.author_wallet}
                isOwnPost={isOwnPost}
                repostTotal={post.repost_total ?? 0}
                repostedByMe={post.reposted_by_me ?? false}
                onReposted={onTipped}
              />
              <LikeButton
                postId={post.id}
                likeTotal={post.like_total ?? 0}
                likedByMe={post.liked_by_me ?? false}
                onLiked={onTipped}
              />
            </div>
          </div>

          {post.is_listing && !isOwnPost && post.listing_active && onMessageProvider && (
            <button
              type="button"
              className="mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold text-base shadow-sm transition-transform duration-150 hover:scale-[1.01] active:scale-[0.99]"
              style={{ backgroundImage: `linear-gradient(to right, ${accent.base}, ${accent.light})` }}
              onClick={() => onMessageProvider(post.author_wallet, post.id)}
            >
              <MessageIcon size={14} />
              Hire
            </button>
          )}
        </div>
      </article>
    </div>
  )
}