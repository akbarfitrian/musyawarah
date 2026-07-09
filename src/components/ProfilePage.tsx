import { useRef, useState } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { usePosts } from '../hooks/usePosts'
import { useProfile } from '../contexts/ProfileContext'
import { useViewedProfile } from '../hooks/useViewedProfile'
import { useFollow } from '../hooks/useFollow'
import { useVerification } from '../hooks/useVerification'
import { useProviderReputation } from '../hooks/useReviews'
import { avatarColor, avatarInitial, shortenAddress } from '../utils/avatar'
import { linkify } from '../utils/linkify'
import { formatBytes, MAX_AVATAR_BYTES, uploadAvatar, validateAvatarFile } from '../lib/avatarUpload'
import { profilePath } from '../utils/routes'
import { CameraIcon, ChevronLeftIcon, MessageIcon, PencilIcon } from './icons'
import { Feed } from './Feed'
import { FollowButton } from './FollowButton'
import { VerifiedBadge } from './VerifiedBadge'
import { RatingStars } from './RatingStars'
import { CopyLinkButton } from './CopyLinkButton'

const BIO_MAX_LEN = 160

export function ProfilePage({
  walletAddress: visitedWallet,
  onChanged,
  onBack,
  onMessage,
  onGetVerified,
  onVisitPost,
  highlightPostId,
}: {
  /** Kalau diisi, halaman ini nampilin profil wallet lain (read-only). Kalau
   * kosong, nampilin profil wallet yang lagi connect (bisa diedit). */
  walletAddress?: string
  onChanged: () => void
  onBack?: () => void
  /** Dipanggil pas tombol "Message" di profil orang lain diklik. */
  onMessage?: (walletAddress: string) => void
  /** Dipanggil pas tombol "Get Verified" di profil sendiri diklik. */
  onGetVerified?: () => void
  /** Dipanggil pas timestamp salah satu post di profil ini diklik -- buka
   * halaman permalink post itu. */
  onVisitPost?: (postId: string) => void
  /** post_id yang harus di-scroll-ke dan disorot di dalam feed profil ini
   * (mis. abis klik "Trending" di RightPanel.tsx). */
  highlightPostId?: string | null
}) {
  const { walletAddress: myWallet, isAutoConnecting, connecting, connect } = useWallet()
  const isOwnProfile = !visitedWallet || visitedWallet === myWallet
  const targetWallet = visitedWallet ?? myWallet

  const { posts, loading, error, refresh } = usePosts(targetWallet ?? undefined)
  const { profile: myProfile, updateProfile } = useProfile()
  const { tier: myVerificationTier } = useVerification()
  const { profile: viewedProfile, verificationTier: viewedVerificationTier, loading: viewedProfileLoading } =
    useViewedProfile(isOwnProfile ? null : targetWallet ?? null)
  const { isFollowing, followerCount, followingCount, loading: followLoading, busy: followBusy, toggleFollow } =
    useFollow(targetWallet ?? null)
  const { reputation } = useProviderReputation(targetWallet ?? null)
  const profile = isOwnProfile ? myProfile : viewedProfile
  const verificationTier = isOwnProfile ? myVerificationTier : viewedVerificationTier

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const [editingBio, setEditingBio] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [savingBio, setSavingBio] = useState(false)
  const [bioError, setBioError] = useState<string | null>(null)

  function refreshAll() {
    refresh()
    onChanged()
  }

  async function handleAvatarPicked(file: File | undefined) {
    if (!file || !myWallet) return
    setAvatarError(null)

    const invalidReason = validateAvatarFile(file)
    if (invalidReason) {
      setAvatarError(invalidReason)
      return
    }

    setUploadingAvatar(true)
    try {
      const publicUrl = await uploadAvatar(myWallet, file)
      await updateProfile({ avatar_url: publicUrl })
      // `refresh()` di sini itu punya usePosts LOKAL punya ProfilePage sendiri
      // (baris atas). Tanpa ini, feed di halaman Profile masih nampilin
      // author_avatar_url lama (snapshot pas fetch pertama), meski avatar
      // di ProfileContext udah keupdate. onChanged() cuma refresh feed Home.
      refresh()
      onChanged() // biar avatar baru ikut muncul di post-post lama di Home
    } catch (e) {
      setAvatarError('Failed to upload photo. Try again.')
      console.error(e)
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function startEditBio() {
    setBioDraft(profile?.bio ?? '')
    setBioError(null)
    setEditingBio(true)
  }

  async function saveBio() {
    setSavingBio(true)
    setBioError(null)
    try {
      await updateProfile({ bio: bioDraft.trim() || null })
      setEditingBio(false)
    } catch (e) {
      setBioError('Failed to save bio. Try again.')
      console.error(e)
    } finally {
      setSavingBio(false)
    }
  }

  if (isAutoConnecting) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-ink-muted">Checking wallet…</p>
      </div>
    )
  }

  // Cuma minta connect kalau lagi mau lihat profil sendiri. Profil orang
  // lain tetap bisa dilihat walau wallet kita sendiri belum connect.
  if (isOwnProfile && !myWallet) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-ink-muted">Connect your wallet first to see your profile & posts.</p>
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

  if (!targetWallet) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-ink-muted">Profile not found.</p>
      </div>
    )
  }

  return (
    <div>
      {!isOwnProfile && onBack && (
        <button
          type="button"
          className="mb-4 flex items-center gap-1.5 text-[14px] font-medium text-ink-muted transition-colors hover:text-ink"
          onClick={onBack}
        >
          <ChevronLeftIcon size={16} />
          Back
        </button>
      )}

      <div className="flex items-start gap-4 rounded-2xl border border-surface-border bg-surface p-5 shadow-card">
        <div className="relative shrink-0">
          <div
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-2xl font-semibold text-white ring-2 ring-brand-violet/50 ring-offset-2 ring-offset-surface"
            style={{ background: avatarColor(targetWallet) }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              avatarInitial(targetWallet)
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-[11px] font-medium text-white">
                Uploading…
              </div>
            )}
          </div>
          {isOwnProfile && (
            <>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-brand-gradient text-accent-contrast shadow-glow transition-transform hover:scale-110 disabled:opacity-60"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Change profile photo"
                title="Change profile photo"
              >
                <CameraIcon size={13} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="visually-hidden"
                onChange={(e) => handleAvatarPicked(e.target.files?.[0])}
              />
            </>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate font-mono text-[16px] font-semibold text-ink">
            {shortenAddress(targetWallet)}
            <VerifiedBadge tier={verificationTier} size={15} />
            <CopyLinkButton path={profilePath(targetWallet)} label="Copy link to profile" className="h-7 w-7" />
          </span>

          {reputation && reputation.review_count > 0 && (
            <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-muted">
              <RatingStars value={reputation.avg_rating} size={12} />
              <span className="font-medium text-ink">{reputation.avg_rating.toFixed(1)}</span>
              <span>
                ({reputation.review_count} review{reputation.review_count === 1 ? '' : 's'})
              </span>
            </span>
          )}

          {isOwnProfile && editingBio ? (
            <div className="mt-2">
              <textarea
                className="w-full resize-none rounded-xl border border-surface-border bg-base px-3 py-2 text-[14px] text-ink placeholder:text-ink-faint focus:border-brand-violet/60 focus:shadow-glow focus:outline-none"
                value={bioDraft}
                maxLength={BIO_MAX_LEN}
                placeholder="Tell us a bit about yourself…"
                onChange={(e) => setBioDraft(e.target.value)}
                rows={2}
                autoFocus
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs tabular-nums text-ink-faint">{BIO_MAX_LEN - bioDraft.length}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-surface-border px-3.5 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
                    onClick={() => setEditingBio(false)}
                    disabled={savingBio}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-brand-gradient px-3.5 py-1.5 text-[13px] font-semibold text-accent-contrast shadow-glow transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60"
                    onClick={saveBio}
                    disabled={savingBio}
                  >
                    {savingBio ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
              {bioError && <p className="mt-1 text-xs text-danger">{bioError}</p>}
            </div>
          ) : (
            <div className="mt-1 flex items-start gap-2">
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[14px] text-ink-muted">
                {viewedProfileLoading && !isOwnProfile
                  ? 'Loading…'
                  : profile?.bio
                    ? linkify(profile.bio)
                    : 'No bio yet.'}
              </p>
              {isOwnProfile && (
                <button
                  type="button"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
                  onClick={startEditBio}
                  aria-label="Edit bio"
                >
                  <PencilIcon size={13} />
                </button>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-surface-border pt-3">
            <div className="flex items-center gap-3 text-[13px] text-ink-muted">
              <span>
                <span className="font-bold text-ink">{posts.length}</span> {posts.length === 1 ? 'post' : 'posts'}
              </span>
              <span>
                <span className="font-bold text-ink">{followerCount}</span> {followerCount === 1 ? 'follower' : 'followers'}
              </span>
              <span>
                <span className="font-bold text-ink">{followingCount}</span> following
              </span>
            </div>

            {isOwnProfile && onGetVerified && (
              <button
                type="button"
                className="rounded-full border border-surface-border px-3.5 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-hover"
                onClick={onGetVerified}
              >
                {verificationTier === 'none' ? 'Get Verified' : 'Manage verification'}
              </button>
            )}

            {!isOwnProfile && myWallet && (
              <div className="flex items-center gap-2">
                <FollowButton
                  isFollowing={isFollowing}
                  loading={followLoading}
                  busy={followBusy}
                  onToggle={toggleFollow}
                />
                {onMessage && (
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-surface-border text-ink transition-colors hover:bg-surface-hover"
                    onClick={() => onMessage(targetWallet)}
                    aria-label="Message"
                    title="Message"
                  >
                    <MessageIcon size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isOwnProfile && (
        <>
          {avatarError && <p className="mt-2 px-1 text-xs text-danger">{avatarError}</p>}
          <p className="mt-2 px-1 text-[12px] text-ink-faint">
            Format JPG/PNG/WEBP/GIF, max {formatBytes(MAX_AVATAR_BYTES)}.
          </p>
        </>
      )}

      <div className="mt-4 -mx-4">
        <Feed
          posts={posts}
          loading={loading}
          error={error}
          onTipped={refreshAll}
          onDeleted={refreshAll}
          onVisitPost={onVisitPost}
          onMessageProvider={onMessage}
          highlightPostId={highlightPostId}
          emptyMessage={
            isOwnProfile
              ? 'No posts yet. Try creating your first post on Home.'
              : 'This account has no posts yet.'
          }
        />
      </div>
    </div>
  )
}
