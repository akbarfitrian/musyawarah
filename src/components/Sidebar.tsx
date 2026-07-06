import { LogoMark, BellIcon, VerifiedNavIcon, HomeIcon, MessageIcon, SettingsIcon, UserIcon } from './icons'
import { ConnectWallet } from './ConnectWallet'
import { focusComposer } from '../utils/composer'

export type View = 'home' | 'profile' | 'messages' | 'verify' | 'settings' | 'notifications'

export function Sidebar({
  view,
  onNavigate,
  unreadMessages = 0,
  unreadNotifications = 0,
}: {
  view: View
  onNavigate: (view: View) => void
  unreadMessages?: number
  unreadNotifications?: number
}) {
  return (
    <aside className="sticky top-0 hidden h-screen flex-col items-start gap-1 border-r border-surface-border px-3 py-4 md:flex">
      <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-black">
        <LogoMark size={26} />
      </div>

      <nav className="flex w-full flex-1 flex-col gap-1">
        <button
          className={`group flex w-auto items-center gap-3 rounded-full px-3 py-3 text-[17px] font-bold transition-colors lg:w-full ${
            view === 'home'
              ? 'text-ink'
              : 'text-ink-muted hover:bg-surface hover:text-ink'
          }`}
          onClick={() => onNavigate('home')}
        >
          <HomeIcon size={22} filled={view === 'home'} />
          <span>Home</span>
        </button>
        <button
          className={`group flex w-auto items-center gap-3 rounded-full px-3 py-3 text-[17px] font-bold transition-colors lg:w-full ${
            view === 'notifications'
              ? 'text-ink'
              : 'text-ink-muted hover:bg-surface hover:text-ink'
          }`}
          onClick={() => onNavigate('notifications')}
        >
          <BellIcon size={22} filled={view === 'notifications'} />
          <span>Notifications</span>
          {unreadNotifications > 0 && (
            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-notify px-1.5 text-[11px] font-bold text-white">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </button>
        <button
          className={`group flex w-auto items-center gap-3 rounded-full px-3 py-3 text-[17px] font-bold transition-colors lg:w-full ${
            view === 'profile'
              ? 'text-ink'
              : 'text-ink-muted hover:bg-surface hover:text-ink'
          }`}
          onClick={() => onNavigate('profile')}
        >
          <UserIcon size={22} filled={view === 'profile'} />
          <span>Profile</span>
        </button>
        <button
          className={`group flex w-auto items-center gap-3 rounded-full px-3 py-3 text-[17px] font-bold transition-colors lg:w-full ${
            view === 'messages'
              ? 'text-ink'
              : 'text-ink-muted hover:bg-surface hover:text-ink'
          }`}
          onClick={() => onNavigate('messages')}
        >
          <MessageIcon size={22} filled={view === 'messages'} />
          <span>Messages</span>
          {unreadMessages > 0 && (
            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-notify px-1.5 text-[11px] font-bold text-white">
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </span>
          )}
        </button>
        <button
          className={`group flex w-auto items-center gap-3 rounded-full px-3 py-3 text-[17px] font-bold transition-colors lg:w-full ${
            view === 'verify'
              ? 'text-ink'
              : 'text-ink-muted hover:bg-surface hover:text-ink'
          }`}
          onClick={() => onNavigate('verify')}
        >
          <span className="flex items-center">
            <VerifiedNavIcon size={22} filled={view === 'verify'} />
          </span>
          <span>Get Verified</span>
        </button>
        <button
          className={`group flex w-auto items-center gap-3 rounded-full px-3 py-3 text-[17px] font-bold transition-colors lg:w-full ${
            view === 'settings'
              ? 'text-ink'
              : 'text-ink-muted hover:bg-surface hover:text-ink'
          }`}
          onClick={() => onNavigate('settings')}
        >
          <SettingsIcon size={22} filled={view === 'settings'} />
          <span>Settings</span>
        </button>
      </nav>

      <button
        className="mb-2 flex h-auto w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-4 py-3 text-accent-contrast shadow-glow transition-transform duration-150 hover:scale-[1.03] hover:shadow-glowCyan active:scale-95"
        onClick={() => {
          if (view !== 'home') {
            onNavigate('home')
            requestAnimationFrame(focusComposer)
          } else {
            focusComposer()
          }
        }}
      >
        <span className="font-display text-[15px] font-bold">Post</span>
      </button>

      <div className="mt-auto w-full">
        <ConnectWallet />
      </div>
    </aside>
  )
}
