import { useEffect, useRef } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { useProfile } from '../contexts/ProfileContext'
import { useVerification } from '../hooks/useVerification'
import { useClickOutside } from '../hooks/useClickOutside'
import { avatarColor, avatarInitial, shortenAddress } from '../utils/avatar'
import { VerifiedBadge } from './VerifiedBadge'
import { ConnectWallet } from './ConnectWallet'
import { LockIcon, SettingsIcon, TrophyIcon, UserIcon, VerifiedNavIcon, XIcon } from './icons'
import type { View } from './Sidebar'

export function MobileNavDrawer({
  open,
  onClose,
  view,
  onNavigate,
  isTreasury = false,
}: {
  open: boolean
  onClose: () => void
  view: View | 'post'
  onNavigate: (view: View) => void
  isTreasury?: boolean
}) {
  const { walletAddress } = useWallet()
  const { profile } = useProfile()
  const { tier: verificationTier } = useVerification()

  const drawerRef = useRef<HTMLDivElement>(null)
  useClickOutside(drawerRef, onClose, open)

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
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

  // Cuma item yang TIDAK punya slot lain (bottom nav sudah pegang
  // Home/Marketplace/Notifications/Messages) — biar nggak dobel, mengikuti
  // pola drawer X yang juga nggak mengulang isi bottom nav-nya.
  const items: { value: View; label: string; icon: React.ReactNode }[] = [
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
        <div className="mb-2 flex items-center justify-between px-1">
          {walletAddress ? (
            <button
              type="button"
              className="flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-2 text-left"
              onClick={() => go('profile')}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px] font-semibold text-white"
                style={{ background: avatarColor(walletAddress) }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  avatarInitial(profile?.username || walletAddress)
                )}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1">
                  <span className="truncate font-display text-[15px] font-bold text-ink">
                    {profile?.username ? `@${profile.username}` : shortenAddress(walletAddress)}
                  </span>
                  <VerifiedBadge tier={verificationTier} size={14} />
                </span>
                {profile?.username && (
                  <span className="block truncate font-mono text-[12px] text-ink-faint">
                    {shortenAddress(walletAddress)}
                  </span>
                )}
              </span>
            </button>
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

        <div className="mt-auto pt-2">
          <ConnectWallet />
        </div>
      </div>
    </div>
  )
}