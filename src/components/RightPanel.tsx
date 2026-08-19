import { useEffect, useRef, useState } from 'react'
import type { TopTippedPeriod } from '../types'
import { SearchIcon, FlameIcon, XIcon } from './icons'
import { VerifiedBadge } from './VerifiedBadge'
import { avatarColor, avatarInitial, shortenAddress } from '../utils/avatar'
import { useUserSearch } from '../hooks/useUserSearch'
import { useTopTipped } from '../hooks/useTopTipped'
import { useTopTippedPosts } from '../hooks/useTopTippedPosts'
import { useClickOutside } from '../hooks/useClickOutside'

const PERIOD_TABS: { value: TopTippedPeriod; label: string }[] = [
  { value: 'weekly', label: 'This Week' },
  { value: 'all_time', label: 'All-Time' },
]

type LeaderboardTab = 'users' | 'trending'

const LEADERBOARD_TABS: { value: LeaderboardTab; label: string }[] = [
  { value: 'users', label: 'Users' },
  { value: 'trending', label: 'Trending' },
]

export function RightPanel({
  searchQuery,
  onSearchChange,
  onVisitProfile,
  onVisitPost,
  mobileOpen = false,
  onMobileClose,
}: {
  searchQuery: string
  onSearchChange: (v: string) => void
  onVisitProfile?: (walletAddress: string) => void
  onVisitPost?: (walletAddress: string, postId: string) => void
  /** Controls the slide-over drawer variant shown below the `lg` breakpoint. */
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const { results: userResults, loading: searching } = useUserSearch(searchQuery)
  const showDropdown = searchQuery.trim().length > 0

  const [period, setPeriod] = useState<TopTippedPeriod>('weekly')
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>('users')

  const { rows: topUsers, loading: loadingUsers } = useTopTipped(period)
  const { rows: topPosts, loading: loadingPosts } = useTopTippedPosts(period)

  const drawerRef = useRef<HTMLDivElement>(null)
  useClickOutside(drawerRef, () => onMobileClose?.(), mobileOpen)

  // Kunci scroll body selagi drawer terbuka di layar <lg
  useEffect(() => {
    if (!mobileOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [mobileOpen])

  // Lepas fokus dari elemen di dalam drawer sebelum wrapper-nya di-aria-hidden,
  // supaya tidak melanggar aturan aria-hidden-focus-descendant.
  useEffect(() => {
    if (mobileOpen) return
    const active = document.activeElement as HTMLElement | null
    if (active && drawerRef.current?.contains(active)) {
      active.blur()
    }
  }, [mobileOpen])

  function selectUser(walletAddress: string) {
    onVisitProfile?.(walletAddress)
    onSearchChange('')
    onMobileClose?.()
  }

  const panelBody = (
    <>
      <div className="relative">
        <div className="flex items-center gap-2.5 rounded-full border border-surface-border bg-surface px-4 py-2.5 transition-colors focus-within:border-brand-violet/60 focus-within:shadow-glow">
          <span className="text-ink-faint">
            <SearchIcon size={16} />
          </span>
          <input
            type="text"
            placeholder="Search users…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent text-[14px] text-ink placeholder:text-ink-faint outline-none"
          />
        </div>

        {showDropdown && (
          <div className="absolute inset-x-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-card">
            {searching && userResults.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-ink-muted">Searching…</p>
            ) : userResults.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-ink-muted">No users match "{searchQuery.trim()}".</p>
            ) : (
              <ul className="flex flex-col py-1">
                {userResults.map((u) => (
                  <li key={u.wallet_address}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover"
                      onClick={() => selectUser(u.wallet_address)}
                    >
                      <span
                        className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full text-[12px] font-semibold text-white"
                        style={{ background: avatarColor(u.wallet_address) }}
                      >
                        <span className="flex h-full w-full items-center justify-center">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            avatarInitial(u.username || u.wallet_address)
                          )}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-[14px] font-semibold text-ink">
                            {u.username ? `@${u.username}` : shortenAddress(u.wallet_address)}
                          </span>
                          <VerifiedBadge tier={u.verification_tier} size={13} />
                        </div>
                        {u.username && (
                          <span className="truncate font-mono text-[12px] text-ink-muted">
                            {shortenAddress(u.wallet_address)}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="m-0 flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
            <span className="text-gold">
              <FlameIcon size={16} />
            </span>
            Top Tipped
          </h2>

          <div className="flex shrink-0 rounded-full bg-base p-0.5">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setPeriod(tab.value)}
                className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                  period === tab.value
                    ? 'bg-surface-hover text-ink shadow-sm'
                    : 'text-ink-faint hover:text-ink-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 flex gap-1 border-b border-surface-border">
          {LEADERBOARD_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setLeaderboardTab(tab.value)}
              className={`-mb-px border-b-2 px-2 pb-2 text-[13px] font-semibold transition-colors ${
                leaderboardTab === tab.value
                  ? 'border-brand-violet text-ink'
                  : 'border-transparent text-ink-faint hover:text-ink-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {leaderboardTab === 'users' ? (
          loadingUsers ? (
            <p className="py-2 text-[13px] text-ink-muted">Loading…</p>
          ) : topUsers.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">
              {period === 'weekly' ? 'No tips sent this week yet.' : 'No tips sent yet.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {topUsers.map((row, i) => (
                <li key={row.wallet_address} className="flex items-center gap-2.5">
                  <span className="w-5 shrink-0 text-center text-[13px] font-semibold text-ink-muted">
                    {i + 1}.
                  </span>
                  <button
                    type="button"
                    className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full text-[12px] font-semibold text-white transition-transform duration-150 hover:scale-105"
                    style={{ background: avatarColor(row.wallet_address) }}
                    onClick={() => onVisitProfile?.(row.wallet_address)}
                    aria-label={`View profile ${shortenAddress(row.wallet_address)}`}
                  >
                    <span className="flex h-full w-full items-center justify-center">
                      {row.avatar_url ? (
                        <img src={row.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        avatarInitial(row.username || row.wallet_address)
                      )}
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-1 hover:underline"
                      onClick={() => onVisitProfile?.(row.wallet_address)}
                    >
                      <span className="truncate font-mono text-[13px] font-semibold text-ink">
                        {row.username ? `@${row.username}` : shortenAddress(row.wallet_address)}
                      </span>
                      <VerifiedBadge tier={row.verification_tier} size={13} />
                    </button>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-blue/15 px-2 py-0.5 text-[12px] font-semibold text-brand-blue">
                    {row.total_amount} UCT
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : loadingPosts ? (
          <p className="py-2 text-[13px] text-ink-muted">Loading…</p>
        ) : topPosts.length === 0 ? (
          <p className="py-2 text-[13px] text-ink-muted">
            {period === 'weekly' ? 'No tipped posts this week yet.' : 'No tipped posts yet.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {topPosts.map((row, i) => (
              <li key={row.post_id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-xl p-1 -m-1 text-left transition-colors hover:bg-surface-hover"
                  onClick={() => onVisitPost?.(row.author_wallet, row.post_id)}
                  aria-label={`View post by ${row.username ? `@${row.username}` : shortenAddress(row.author_wallet)}`}
                >
                  <span className="w-5 shrink-0 text-center text-[13px] font-semibold text-ink-muted">
                    {i + 1}.
                  </span>
                  <span
                    className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full text-[12px] font-semibold text-white"
                    style={{ background: avatarColor(row.author_wallet) }}
                  >
                    <span className="flex h-full w-full items-center justify-center">
                      {row.avatar_url ? (
                        <img src={row.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        avatarInitial(row.username || row.author_wallet)
                      )}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="truncate font-mono text-[13px] font-semibold text-ink">
                        {row.username ? `@${row.username}` : shortenAddress(row.author_wallet)}
                      </span>
                      <VerifiedBadge tier={row.verification_tier} size={13} />
                    </span>
                    <span className="line-clamp-1 block text-[13px] text-ink-muted">{row.content}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-brand-blue/15 px-2 py-0.5 text-[12px] font-semibold text-brand-blue">
                    {row.total_amount} UCT
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {period === 'weekly' && (
          <p className="mt-3 border-t border-surface-border pt-2.5 text-[11px] text-ink-faint">
            Resets Monday 00:00 UTC
          </p>
        )}
      </div>

      <p className="px-1 text-[12px] text-ink-faint">Musyawarah © 2026</p>
    </>
  )

  return (
    <>
      {/* Panel tetap (desktop, ≥ lg) */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-4 overflow-y-auto px-4 py-4 lg:flex">
        {panelBody}
      </aside>

      {/* Drawer slide-over (< lg), dikontrol oleh tombol toggle di header mobile */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onMobileClose}
        />
        <div
          ref={drawerRef}
          role="dialog"
          aria-label="Leaderboard & Search"
          className={`absolute right-0 top-0 flex h-full w-[86%] max-w-[360px] flex-col gap-4 overflow-y-auto bg-base px-4 py-4 shadow-2xl transition-transform duration-200 ease-out ${
            mobileOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="m-0 font-display text-[16px] font-bold text-ink">Leaderboard</h2>
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Tutup panel"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <XIcon size={16} />
            </button>
          </div>
          {panelBody}
        </div>
      </div>
    </>
  )
}