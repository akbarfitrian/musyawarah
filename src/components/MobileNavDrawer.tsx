import { useEffect, useRef, useState } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { useProfile } from '../contexts/ProfileContext'
import { useVerification } from '../hooks/useVerification'
import { useClickOutside } from '../hooks/useClickOutside'
import { avatarColor, avatarInitial, shortenAddress } from '../utils/avatar'
import { VerifiedBadge } from './VerifiedBadge'
import { ConnectWallet } from './ConnectWallet'
import { fromBaseUnits } from '../lib/sphereConnect'
import {
  BellIcon,
  BriefcaseIcon,
  ChevronDownIcon,
  HomeIcon,
  LockIcon,
  LogoutIcon,
  MessageIcon,
  RefreshIcon,
  SettingsIcon,
  TrophyIcon,
  UserIcon,
  VerifiedNavIcon,
  XIcon,
} from './icons'
import type { View } from './Sidebar'

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatAmount(amountBase: string, decimals: number): string {
  const value = Number(fromBaseUnits(amountBase, decimals))
  if (Number.isNaN(value)) return fromBaseUnits(amountBase, decimals)
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

export function MobileNavDrawer({
  open,
  onClose,
  view,
  onNavigate,
  isTreasury = false,
  unreadMessages = 0,
  unreadNotifications = 0,
}: {
  open: boolean
  onClose: () => void
  view: View | 'post'
  onNavigate: (view: View) => void
  isTreasury?: boolean
  unreadMessages?: number
  unreadNotifications?: number
}) {
  const {
    walletAddress,
    assets,
    totalFiat,
    balanceLoading,
    refreshBalance,
    disconnect,
    isWalletLocked,
  } = useWallet()
  const { profile } = useProfile()
  const { tier: verificationTier } = useVerification()
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const [assetsOpen, setAssetsOpen] = useState(false)

  const totalUsd = totalFiat !== null ? totalFiat : assets.filter((a) => a.valueUsd).length > 0
    ? assets.reduce((sum, a) => sum + (a.valueUsd ?? 0), 0)
    : null

  const drawerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  useClickOutside(drawerRef, onClose, open)
  useClickOutside(headerRef, () => {
    setWalletMenuOpen(false)
    setAssetsOpen(false)
  }, walletMenuOpen)

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  // Tutup dropdown wallet saat drawer ditutup.
  useEffect(() => {
    if (!open) {
      setWalletMenuOpen(false)
      setAssetsOpen(false)
    }
  }, [open])

  // Lepas fokus dari elemen di dalam drawer sebelum wrapper-nya di-aria-hidden.
  useEffect(() => {
    if (open) return
    const active = document.activeElement as HTMLElement | null
    if (active && drawerRef.current?.contains(active)) {
      active.blur()
    }
  }, [open])

  function go(v: View) {
    onNavigate(v)
    onClose()
  }

  // Sekarang menampilkan semua tujuan navigasi, termasuk yang juga ada di
  // bottom nav (Home/Marketplace/Notifications/Messages) — biar drawer
  // benar-benar jadi menu lengkap, bukan cuma pelengkap bottom nav.
  const items: { value: View; label: string; icon: React.ReactNode; badge?: number }[] = [
    { value: 'home', label: 'Home', icon: <HomeIcon size={20} filled={view === 'home'} /> },
    {
      value: 'marketplace',
      label: 'Marketplace',
      icon: <BriefcaseIcon size={20} />,
    },
    {
      value: 'notifications',
      label: 'Notifications',
      icon: <BellIcon size={20} filled={view === 'notifications'} />,
      badge: unreadNotifications,
    },
    {
      value: 'messages',
      label: 'Messages',
      icon: <MessageIcon size={20} filled={view === 'messages'} />,
      badge: unreadMessages,
    },
    { value: 'profile', label: 'Profile', icon: <UserIcon size={20} filled={view === 'profile'} /> },
    { value: 'quests', label: 'Quests', icon: <TrophyIcon size={20} filled={view === 'quests'} /> },
    { value: 'verify', label: 'Get Verified', icon: <VerifiedNavIcon size={20} filled={view === 'verify'} /> },
    { value: 'settings', label: 'Settings', icon: <SettingsIcon size={20} filled={view === 'settings'} /> },
  ]

  return (
    <div className={`fixed inset-0 z-40 md:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-label="Menu navigasi"
        className={`absolute left-0 top-0 flex h-full w-[82%] max-w-[320px] flex-col gap-1 overflow-y-auto bg-base px-3 py-4 shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative mb-2 flex items-center justify-between px-1" ref={headerRef}>
          {walletAddress ? (
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full py-1 pr-1 text-left"
                onClick={() => go('profile')}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px] font-semibold text-white"
                  style={{ background: avatarColor(walletAddress) }}
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    avatarInitial(profile?.name || walletAddress)
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1">
                    <span className="truncate font-display text-[15px] font-bold text-ink">
                      {profile?.name || shortenAddress(walletAddress)}
                    </span>
                    <VerifiedBadge tier={verificationTier} size={14} />
                  </span>
                  {isWalletLocked ? (
                    <span className="block truncate text-[11px] font-medium text-danger">wallet locked</span>
                  ) : (
                    <span className="flex items-center gap-1 truncate font-mono text-[12px] text-ink-faint">
                      {profile?.name ? shortenAddress(walletAddress) : null}
                    </span>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setWalletMenuOpen((v) => !v)}
                aria-label="Buka menu wallet"
                aria-expanded={walletMenuOpen}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink ${
                  walletMenuOpen ? 'bg-surface-hover text-ink' : ''
                }`}
              >
                <ChevronDownIcon size={16} className={walletMenuOpen ? 'rotate-180' : ''} />
              </button>
            </div>
          ) : (
            <span className="font-display text-[16px] font-bold text-ink">Menu</span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <XIcon size={16} />
          </button>

          {walletMenuOpen && walletAddress && (
            <div className="absolute left-0 top-full z-30 mt-1 w-full animate-scale-in rounded-2xl border border-surface-border bg-surface-soft p-1.5 shadow-card">
              <div className="flex items-center justify-between px-3 pb-1.5 pt-1">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted">
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
                  Total balance
                </span>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50"
                  onClick={() => refreshBalance()}
                  disabled={balanceLoading}
                  aria-label="Refresh balance"
                  title="Refresh balance"
                >
                  <RefreshIcon size={13} />
                </button>
              </div>

              <div className="px-3 pb-2">
                <span className="font-mono text-[20px] font-bold text-ink">
                  {totalUsd !== null ? formatUsd(totalUsd) : balanceLoading ? 'Loading…' : '—'}
                </span>
              </div>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-ink transition-colors hover:bg-surface-hover"
                onClick={() => setAssetsOpen((v) => !v)}
                aria-expanded={assetsOpen}
              >
                <span className="flex items-center gap-1.5">
                  View assets
                  <span
                    className="text-ink-faint transition-transform duration-150"
                    style={{ transform: assetsOpen ? 'rotate(180deg)' : 'none' }}
                  >
                    <ChevronDownIcon size={12} />
                  </span>
                </span>
                <span className="text-ink-faint">{assets.length > 0 ? `${assets.length} tokens` : ''}</span>
              </button>

              {assetsOpen && (
                <div className="mb-1.5 max-h-40 overflow-y-auto rounded-xl bg-surface px-1 py-1">
                  {assets.length === 0 ? (
                    <div className="px-2 py-2 text-[12.5px] text-ink-faint">
                      {balanceLoading ? 'Loading tokens…' : 'No tokens yet'}
                    </div>
                  ) : (
                    assets.map((asset) => (
                      <div key={asset.coinId ?? asset.symbol} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[10px] font-semibold text-ink-faint">
                          {asset.symbol.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-[12.5px] font-medium text-ink">${asset.symbol}</div>
                          <div className="truncate text-[11px] text-ink-faint">
                            {formatAmount(asset.amountBase, asset.decimals)}
                          </div>
                        </div>
                        {asset.valueUsd ? (
                          <div className="shrink-0 font-mono text-[12px] text-ink-muted">{formatUsd(asset.valueUsd)}</div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="mx-1 mb-1.5 border-t border-surface-border" />

              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-ink transition-colors hover:bg-surface-hover"
                onClick={() => {
                  disconnect()
                  setWalletMenuOpen(false)
                  setAssetsOpen(false)
                }}
              >
                <LogoutIcon size={16} />
                Disconnect wallet
              </button>
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 pt-1">
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold transition-colors ${
                view === item.value ? 'bg-surface-hover text-ink' : 'text-ink-muted hover:bg-surface hover:text-ink'
              }`}
              onClick={() => go(item.value)}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-notify px-1 text-[10px] font-bold text-white">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              ) : null}
            </button>
          ))}
          {isTreasury && (
            <button
              type="button"
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold transition-colors ${
                view === 'admin' ? 'bg-surface-hover text-ink' : 'text-ink-muted hover:bg-surface hover:text-ink'
              }`}
              onClick={() => go('admin')}
            >
              <LockIcon size={18} />
              <span className="flex-1">Admin</span>
            </button>
          )}
        </nav>

        {!walletAddress && (
          <div className="mt-auto pt-2">
            <ConnectWallet />
          </div>
        )}
      </div>
    </div>
  )
}