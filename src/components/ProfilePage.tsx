import { useRef, useState } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { usePosts } from '../hooks/usePosts'
import { useProfile } from '../contexts/ProfileContext'
import { useViewedProfile } from '../hooks/useViewedProfile'
import { useFollow } from '../hooks/useFollow'
import { useVerification } from '../hooks/useVerification'
import { useProviderReputation } from '../hooks/useReviews'
import { useSwipeTabs } from '../hooks/useSwipeTabs'
import { avatarColor, avatarInitial, shortenAddress } from '../utils/avatar'
import { linkify } from '../utils/linkify'
import { uploadAvatar, validateAvatarFile } from '../lib/avatarUpload'
import { getNameChangeEligibility } from '../utils/nameCooldown'
import { CameraIcon, ChevronLeftIcon, MessageIcon, MoreIcon, PencilIcon } from './icons'
import { Feed } from './Feed'
import { FollowButton } from './FollowButton'
import { VerifiedBadge } from './VerifiedBadge'
import { RatingStars } from './RatingStars'

const BIO_MAX_LEN = 160
const NAME_MAX_LEN = 50
const PROFILE_TABS = ['posts', 'listings'] as const

export function ProfilePage({
  walletAddress: visitedWallet,
  onChanged,
  onBack,
  onMessage,
  onGetVerified,
  onVisitPost,
  highlightPostId,
}: {
  walletAddress?: string
  onChanged: () => void
  onBack?: () => void
  onMessage?: (walletAddress: string) => void
  onGetVerified?: () => void
  onVisitPost?: (postId: string) => void
  highlightPostId?: string | null
}) {
  const { walletAddress: myWallet, isAutoConnecting, connecting, connect } = useWallet()
  const isOwnProfile = !visitedWallet || visitedWallet === myWallet
  const targetWallet = visitedWallet ?? myWallet

  const { posts, loading, error, refresh } = usePosts(targetWallet ?? undefined)
  const [profileTab, setProfileTab] = useState<'posts' | 'listings'>('posts')
  const regularPosts = posts.filter((p) => !p.is_listing)
  const listingPosts = posts.filter((p) => p.is_listing && (isOwnProfile || p.listing_active))
  const profilePosts = profileTab === 'listings' ? listingPosts : regularPosts
  const { profile: myProfile, updateProfile } = useProfile()
  const { tier: myVerificationTier } = useVerification()
  const { profile: viewedProfile, verificationTier: viewedVerificationTier, loading: viewedProfileLoading } =
    useViewedProfile(isOwnProfile ? null : targetWallet ?? null)
  const { isFollowing, followerCount, followingCount, loading: followLoading, busy: followBusy, toggleFollow } =
    useFollow(targetWallet ?? null)
  const { reputation } = useProviderReputation(targetWallet ?? null)
  const profile = isOwnProfile ? myProfile : viewedProfile
  const verificationTier = isOwnProfile ? myVerificationTier : viewedVerificationTier
  const nameEligibility = getNameChangeEligibility(profile?.name_updated_at)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const [bioDraft, setBioDraft] = useState('')
  const [nameDraft, setNameDraft] = useState('')

  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

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
      refresh()
      onChanged()
    } catch (e) {
      setAvatarError('Failed to upload photo. Try again.')
      console.error(e)
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function openEditProfile() {
    setNameDraft(profile?.name ?? '')
    setBioDraft(profile?.bio ?? '')
    setProfileError(null)
    setAvatarError(null)
    setProfileMenuOpen(false)
    setEditProfileOpen(true)
  }

  async function saveProfile() {
    setSavingProfile(true)
    setProfileError(null)
    try {
      const fields: { name?: string | null; bio?: string | null } = { bio: bioDraft.trim() || null }
      if (nameEligibility.canChange) fields.name = nameDraft.trim() || null
      await updateProfile(fields)
      setEditProfileOpen(false)
    } catch (e) {
      const message = (e as { message?: string } | null)?.message ?? ''
      if (message.includes('name_cooldown_active')) {
        setProfileError('You can only change your name once every 30 days.')
      } else {
        setProfileError('Failed to save changes. Try again.')
      }
      console.error(e)
    } finally {
      setSavingProfile(false)
    }
  }

  const swipeTabProps = useSwipeTabs(PROFILE_TABS, profileTab, setProfileTab)

  if (isAutoConnecting) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-ink-muted">Checking wallet…</p>
      </div>
    )
  }

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

      <div className="relative flex items-start gap-3 rounded-2xl border border-surface-border bg-surface p-4 shadow-card sm:gap-4 sm:p-5">
        {isOwnProfile && (
          <div className="absolute right-3 top-3">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
              onClick={() => setProfileMenuOpen((v) => !v)}
              aria-label="Profile options"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              title="Profile options"
            >
              <MoreIcon size={17} />
            </button>
            {profileMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setProfileMenuOpen(false)} />
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-1 w-44 animate-scale-in overflow-hidden rounded-xl border border-surface-border bg-surface-soft py-1 shadow-card"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-ink transition-colors hover:bg-surface-hover"
                    onClick={openEditProfile}
                  >
                    <PencilIcon size={14} />
                    Edit profile
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <div className="relative shrink-0">
          <div
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-xl font-semibold text-white ring-2 ring-brand-violet/50 ring-offset-2 ring-offset-surface sm:h-20 sm:w-20 sm:text-2xl"
            style={{ background: avatarColor(targetWallet) }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              avatarInitial(targetWallet)
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 pr-9">
            <span className="truncate text-[15px] font-semibold text-ink sm:text-[16px]">
              {profile?.name || shortenAddress(targetWallet)}
            </span>
            <VerifiedBadge tier={verificationTier} size={15} />
          </div>

          {profile?.name && (
            <p className="m-0 truncate font-mono text-[13px] text-ink-muted">{shortenAddress(targetWallet)}</p>
          )}

          {reputation && reputation.review_count > 0 && (
            <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-muted">
              <RatingStars value={reputation.avg_rating} size={12} />
              <span className="font-medium text-ink">{reputation.avg_rating.toFixed(1)}</span>
              <span>
                ({reputation.review_count} review{reputation.review_count === 1 ? '' : 's'})
              </span>
            </span>
          )}

          <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-[13px] text-ink-muted sm:text-[14px]">
            {viewedProfileLoading && !isOwnProfile
              ? 'Loading…'
              : profile?.bio
                ? linkify(profile.bio)
                : 'No bio yet.'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-surface-border pt-3 sm:gap-x-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-muted sm:gap-x-3 sm:text-[13px]">
              <span>
                <span className="font-bold text-ink">{regularPosts.length}</span>{' '}
                {regularPosts.length === 1 ? 'post' : 'posts'}
              </span>
              <span>
                <span className="font-bold text-ink">{listingPosts.length}</span>{' '}
                {listingPosts.length === 1 ? 'listing' : 'listings'}
              </span>
              <span>
                <span className="font-bold text-ink">{followerCount}</span> {followerCount === 1 ? 'follower' : 'followers'}
              </span>
              <span>
                <span className="font-bold text-ink">{followingCount}</span> following
              </span>
            </div>

            {!isOwnProfile && myWallet && (
              <div className="ml-auto flex shrink-0 items-center gap-2">
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

      {editProfileOpen && (
        <div
          className="fixed inset-0 z-40 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm animate-scale-in rounded-2xl border border-surface-border bg-surface-soft p-5 shadow-card">
            <h2 className="text-[16px] font-semibold text-ink">Edit profile</h2>

            <div className="mt-4 flex justify-center">
              <div className="relative">
                <div
                  className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full text-3xl font-semibold text-white"
                  style={{ background: targetWallet ? avatarColor(targetWallet) : undefined }}
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    targetWallet && avatarInitial(targetWallet)
                  )}
                  <button
                    type="button"
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100 disabled:opacity-100"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label="Change profile photo"
                    title="Change profile photo"
                  >
                    {uploadingAvatar ? (
                      <span className="text-[11px] font-medium">Uploading…</span>
                    ) : (
                      <CameraIcon size={22} />
                    )}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="visually-hidden"
                  onChange={(e) => handleAvatarPicked(e.target.files?.[0])}
                />
              </div>
            </div>
            {avatarError && <p className="mt-2 text-center text-xs text-danger">{avatarError}</p>}

            <div className="mt-4">
              <label className="text-[12px] font-medium text-ink-muted">Name</label>
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-surface-border bg-base px-3 py-1.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-brand-violet/60 focus:shadow-glow focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                value={nameDraft}
                maxLength={NAME_MAX_LEN}
                placeholder="Add your name"
                onChange={(e) => setNameDraft(e.target.value)}
                disabled={!nameEligibility.canChange}
                autoFocus
              />
              <p className="mt-1 text-xs text-ink-faint">
                {nameEligibility.canChange
                  ? `${NAME_MAX_LEN - nameDraft.length} characters left`
                  : `You can change your name again in ${nameEligibility.daysRemaining} day${nameEligibility.daysRemaining === 1 ? '' : 's'}.`}
              </p>
            </div>

            <div className="mt-3">
              <label className="text-[12px] font-medium text-ink-muted">Bio</label>
              <textarea
                className="mt-1 w-full resize-none rounded-xl border border-surface-border bg-base px-3 py-2 text-[14px] text-ink placeholder:text-ink-faint focus:border-brand-violet/60 focus:shadow-glow focus:outline-none"
                value={bioDraft}
                maxLength={BIO_MAX_LEN}
                placeholder="Tell us a bit about yourself…"
                onChange={(e) => setBioDraft(e.target.value)}
                rows={3}
              />
              <p className="mt-1 text-xs text-ink-faint">{BIO_MAX_LEN - bioDraft.length} characters left</p>
            </div>

            {profileError && <p className="mt-2 text-xs text-danger">{profileError}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-surface-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
                onClick={() => setEditProfileOpen(false)}
                disabled={savingProfile}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-accent-contrast shadow-glow transition-transform duration-150 hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                onClick={saveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 -mx-4" {...swipeTabProps}>
        <div className="mx-4 mb-1 flex gap-1 border-b border-surface-border">
          <button
            type="button"
            className={`px-3 pb-2.5 text-[14px] font-semibold transition-colors ${
              profileTab === 'posts' ? 'border-b-2 border-brand-violetSoft text-ink' : 'text-ink-muted hover:text-ink'
            }`}
            onClick={() => setProfileTab('posts')}
          >
            Posts
          </button>
          <button
            type="button"
            className={`px-3 pb-2.5 text-[14px] font-semibold transition-colors ${
              profileTab === 'listings' ? 'border-b-2 border-gold text-ink' : 'text-ink-muted hover:text-ink'
            }`}
            onClick={() => setProfileTab('listings')}
          >
            Listings
          </button>
        </div>
        <Feed
          posts={profilePosts}
          loading={loading}
          error={error}
          onTipped={refreshAll}
          onDeleted={refreshAll}
          onVisitPost={onVisitPost}
          onMessageProvider={onMessage}
          highlightPostId={highlightPostId}
          emptyMessage={
            profileTab === 'listings'
              ? isOwnProfile
                ? 'No skill listings yet. Post one from Home.'
                : 'This account has no skill listings yet.'
              : isOwnProfile
                ? 'No posts yet. Try creating your first post on Home.'
                : 'This account has no posts yet.'
          }
        />
      </div>
    </div>
  )
}