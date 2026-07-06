import { useState } from 'react'
import { UserCheckIcon, UserPlusIcon } from './icons'

/**
 * Presentational aja — statenya (isFollowing, loading, dll) sengaja diangkat
 * ke pemanggilnya (lewat `useFollow`) biar cuma ada SATU instance hook per
 * profil. Kalau tiap komponen manggil useFollow sendiri-sendiri, count
 * followers/following bisa nggak sinkron abis toggle (persis kayak bug
 * avatar basi kemarin).
 */
export function FollowButton({
  isFollowing,
  loading,
  busy,
  onToggle,
}: {
  isFollowing: boolean
  loading: boolean
  busy: boolean
  onToggle: () => void
}) {
  const [hovering, setHovering] = useState(false)

  if (loading) {
    return <div className="h-9 w-[104px] shrink-0 animate-pulse rounded-full bg-surface-hover" aria-hidden="true" />
  }

  // Kayak Twitter/X: tombol "Following" pas di-hover berubah jadi merah +
  // teks "Unfollow", biar jelas klik itu bakal nge-unfollow.
  return (
    <button
      type="button"
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors disabled:opacity-60 ${
        isFollowing
          ? hovering
            ? 'border border-danger/40 bg-danger/10 text-danger'
            : 'border border-surface-border bg-surface text-ink'
          : 'bg-brand-gradient text-accent-contrast shadow-glow hover:scale-[1.03] active:scale-95'
      }`}
      onClick={onToggle}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      disabled={busy}
      aria-pressed={isFollowing}
    >
      {isFollowing ? (
        hovering ? (
          <>
            <UserPlusIcon size={15} />
            Unfollow
          </>
        ) : (
          <>
            <UserCheckIcon size={15} />
            Following
          </>
        )
      ) : (
        <>
          <UserPlusIcon size={15} />
          Follow
        </>
      )}
    </button>
  )
}
