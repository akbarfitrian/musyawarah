import { useState } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { WalletProvider } from './contexts/WalletContext'
import { ProfileProvider } from './contexts/ProfileContext'
import { usePosts } from './hooks/usePosts'
import { useConversations } from './hooks/useMessages'
import { useNotifications } from './hooks/useNotifications'
import { Sidebar, type View } from './components/Sidebar'
import { RightPanel } from './components/RightPanel'
import { PostComposer } from './components/PostComposer'
import { Feed } from './components/Feed'
import { ProfilePage } from './components/ProfilePage'
import { GetVerifiedPage } from './components/GetVerifiedPage'
import { MessagesPage } from './components/MessagesPage'
import { NotificationsPage } from './components/NotificationsPage'
import { SettingsPage } from './components/SettingsPage'
import { ConnectWallet } from './components/ConnectWallet'
import { BellIcon, FeatherIcon, LogoMark, SettingsIcon } from './components/icons'
import { focusComposer } from './utils/composer'
import { shortenAddress } from './utils/avatar'
import './index.css'

function AppShell() {
  const { posts, loading, error, refresh } = usePosts()
  const { totalUnread } = useConversations()
  const { unreadCount: unreadNotifications } = useNotifications()
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<View>('home')
  // Wallet profil orang lain yang lagi dikunjungi. null = lihat profil sendiri.
  const [viewedWallet, setViewedWallet] = useState<string | null>(null)
  // Wallet yang thread-nya harus langsung kebuka pas masuk ke tab Messages
  // (mis. abis klik "Message" di profil orang lain).
  const [dmTarget, setDmTarget] = useState<string | null>(null)

  function visitProfile(walletAddress: string) {
    setViewedWallet(walletAddress)
    setView('profile')
  }

  function goToOwnProfile() {
    setViewedWallet(null)
    setView('profile')
  }

  function messageWallet(walletAddress: string) {
    setDmTarget(walletAddress)
    setView('messages')
  }

  const headerTitle =
    view === 'home'
      ? 'Home'
      : view === 'notifications'
        ? 'Notifications'
        : view === 'messages'
          ? 'Messages'
          : view === 'verify'
            ? 'Get Verified'
            : view === 'settings'
              ? 'Settings'
              : viewedWallet
                ? shortenAddress(viewedWallet)
                : 'Profile'

  return (
    <div className="mx-auto grid min-h-screen max-w-[1280px] grid-cols-1 items-start md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[275px_minmax(0,600px)_350px]">
      <Sidebar
        view={view}
        onNavigate={(v) => (v === 'profile' ? goToOwnProfile() : setView(v))}
        unreadMessages={totalUnread}
        unreadNotifications={unreadNotifications}
      />

      <main className="min-h-screen border-surface-border pb-20 md:border-x md:pb-0">
        <header className="sticky top-0 z-10 hidden border-b border-surface-border bg-base/80 px-4 py-3 backdrop-blur-xl md:block">
          <h1 className="m-0 font-display text-[19px] font-bold tracking-tight text-ink">{headerTitle}</h1>
        </header>

        {view === 'home' ? (
          <>
            <PostComposer onPosted={refresh} onGetVerified={() => setView('verify')} />
            <Feed
              posts={posts}
              loading={loading}
              error={error}
              onTipped={refresh}
              onDeleted={refresh}
              onVisitProfile={visitProfile}
            />
          </>
        ) : view === 'notifications' ? (
          <NotificationsPage onVisitProfile={visitProfile} />
        ) : view === 'messages' ? (
          <MessagesPage
            openWallet={dmTarget}
            onConsumeOpenWallet={() => setDmTarget(null)}
            onVisitProfile={visitProfile}
          />
        ) : view === 'verify' ? (
          <div className="px-4 pt-4">
            <GetVerifiedPage onBack={() => setView('home')} />
          </div>
        ) : view === 'settings' ? (
          <div className="px-4 pt-4">
            <SettingsPage onBack={() => setView('home')} />
          </div>
        ) : (
          <div className="px-4 pt-4">
            <ProfilePage
              walletAddress={viewedWallet ?? undefined}
              onChanged={refresh}
              onMessage={messageWallet}
              onGetVerified={() => setView('verify')}
              onBack={() => {
                setViewedWallet(null)
                setView('home')
              }}
            />
          </div>
        )}
      </main>

      <RightPanel
        posts={posts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onVisitProfile={visitProfile}
      />

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-border bg-base/80 px-4 py-2.5 backdrop-blur-xl md:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-black">
          <LogoMark size={20} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              view === 'notifications' ? 'bg-surface-hover text-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
            }`}
            onClick={() => setView('notifications')}
            aria-label="Notifications"
          >
            <BellIcon size={19} filled={view === 'notifications'} />
            {unreadNotifications > 0 && (
              <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-notify" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              view === 'settings' ? 'bg-surface-hover text-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
            }`}
            onClick={() => setView('settings')}
            aria-label="Settings"
          >
            <SettingsIcon size={19} filled={view === 'settings'} />
          </button>
          <ConnectWallet />
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-surface-border bg-surface/90 backdrop-blur-xl md:hidden">
        <button
          className={`flex flex-1 items-center justify-center py-3 text-[15px] font-bold transition-colors ${
            view === 'home' ? 'text-brand-violetSoft' : 'text-ink-muted'
          }`}
          onClick={() => setView('home')}
        >
          Home
        </button>
        <button
          className={`flex flex-1 items-center justify-center py-3 text-[15px] font-bold transition-colors ${
            view === 'profile' ? 'text-brand-violetSoft' : 'text-ink-muted'
          }`}
          onClick={goToOwnProfile}
        >
          Profile
        </button>
        <button
          className={`relative flex flex-1 items-center justify-center py-3 text-[15px] font-bold transition-colors ${
            view === 'messages' ? 'text-brand-violetSoft' : 'text-ink-muted'
          }`}
          onClick={() => setView('messages')}
        >
          Messages
          {totalUnread > 0 && (
            <span className="absolute right-[26%] top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-notify px-1 text-[10px] font-bold text-white">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
        <button
          className={`flex flex-1 items-center justify-center py-3 text-[15px] font-bold transition-colors ${
            view === 'verify' ? 'text-brand-violetSoft' : 'text-ink-muted'
          }`}
          onClick={() => setView('verify')}
        >
          Verify
        </button>
      </nav>

      <button
        className="fixed bottom-[76px] right-5 z-[25] flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-accent-contrast shadow-glow transition-transform duration-150 hover:scale-105 active:scale-95 md:hidden"
        onClick={() => {
          if (view !== 'home') {
            setView('home')
            // tunggu satu tick biar composer-nya kerender dulu sebelum di-focus
            requestAnimationFrame(focusComposer)
          } else {
            focusComposer()
          }
        }}
        aria-label="New post"
      >
        <FeatherIcon size={22} />
      </button>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <ProfileProvider>
          <AppShell />
        </ProfileProvider>
      </WalletProvider>
    </ThemeProvider>
  )
}
