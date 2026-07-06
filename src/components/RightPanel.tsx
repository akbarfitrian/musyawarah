import type { Post } from '../types'
import { SearchIcon, FlameIcon } from './icons'
import { VerifiedBadge } from './VerifiedBadge'
import { avatarColor, avatarInitial, resolveAuthorAvatar, shortenAddress } from '../utils/avatar'
import { useWallet } from '../contexts/WalletContext'
import { useProfile } from '../contexts/ProfileContext'
import { useUserSearch } from '../hooks/useUserSearch'

export function RightPanel({
  posts,
  searchQuery,
  onSearchChange,
  onVisitProfile,
}: {
  posts: Post[]
  searchQuery: string
  onSearchChange: (v: string) => void
  onVisitProfile?: (walletAddress: string) => void
}) {
  const { walletAddress } = useWallet()
  const { profile: myProfile } = useProfile()
  const { results: userResults, loading: searching } = useUserSearch(searchQuery)
  const showDropdown = searchQuery.trim().length > 0

  const topTipped = [...posts]
    .filter((p) => (p.tip_total ?? 0) > 0)
    .sort((a, b) => (b.tip_total ?? 0) - (a.tip_total ?? 0))
    .slice(0, 5)

  function selectUser(walletAddress: string) {
    onVisitProfile?.(walletAddress)
    onSearchChange('')
  }

  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-4 overflow-y-auto px-4 py-4 lg:flex">
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
        <h2 className="m-0 mb-3 flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
          <span className="text-gold">
            <FlameIcon size={16} />
          </span>
          Top tipped
        </h2>

        {topTipped.length === 0 ? (
          <p className="py-2 text-[13px] text-ink-muted">No tipped posts yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {topTipped.map((p, i) => {
              const avatarUrl = resolveAuthorAvatar(p.author_wallet, p.author_avatar_url, walletAddress, myProfile?.avatar_url)
              return (
              <li key={p.id} className="flex items-center gap-2.5">
                <span className="w-5 shrink-0 text-center text-[13px] font-semibold text-ink-muted">
                  {i + 1}.
                </span>
                <button
                  type="button"
                  className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full text-[12px] font-semibold text-white transition-transform duration-150 hover:scale-105"
                  style={{ background: avatarColor(p.author_wallet) }}
                  onClick={() => onVisitProfile?.(p.author_wallet)}
                  aria-label={`View profile ${shortenAddress(p.author_wallet)}`}
                >
                  <span className="flex h-full w-full items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      avatarInitial(p.author_wallet)
                    )}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="truncate font-mono text-[13px] font-semibold text-ink hover:underline"
                      onClick={() => onVisitProfile?.(p.author_wallet)}
                    >
                      {shortenAddress(p.author_wallet)}
                    </button>
                    <VerifiedBadge tier={p.author_verification_tier} size={13} />
                  </div>
                  <span className="line-clamp-1 text-[13px] text-ink-muted">{p.content}</span>
                </div>
                <span className="shrink-0 rounded-full bg-brand-blue/15 px-2 py-0.5 text-[12px] font-semibold text-brand-blue">
                  {p.tip_total} UCT
                </span>
              </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="px-1 text-[12px] text-ink-faint">Musyawarah © 2026</p>
    </aside>
  )
}
