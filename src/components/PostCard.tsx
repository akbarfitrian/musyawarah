import { useState } from 'react'
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
import { TrashIcon, RepostIcon, PencilIcon, XIcon } from './icons'

export function PostCard({
  post,
  onTipped,
  onDeleted,
  onVisitProfile,
}: {
  post: Post
  onTipped: () => void
  onDeleted: () => void
  onVisitProfile?: (walletAddress: string) => void
}) {
  const { walletAddress } = useWallet()
  const { profile: myProfile } = useProfile()
  const { tier: myTier } = useVerification()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const isOwnPost = walletAddress === post.author_wallet
  const avatarUrl = resolveAuthorAvatar(post.author_wallet, post.author_avatar_url, walletAddress, myProfile?.avatar_url)

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

  return (
    <div className="border-b border-surface-border px-4 pt-3 transition-colors hover:bg-surface/40">
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
            <span className="shrink-0 text-[13px] text-ink-muted">{timeAgo(post.created_at)}</span>
            {post.edited_at && <span className="shrink-0 text-[12px] text-ink-faint">· edited</span>}
            {(canEdit || isOwnPost) && (
              <span className="ml-auto flex items-center gap-1">
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
                {isOwnPost && (
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={deleting}
                    aria-label="Delete post"
                    title="Delete post"
                  >
                    <TrashIcon size={15} />
                  </button>
                )}
              </span>
            )}
          </div>

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

          <div className="mt-2.5 flex max-w-xs items-center gap-6">
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
          </div>
        </div>
      </article>
    </div>
  )
}
