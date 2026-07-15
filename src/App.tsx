import { useEffect, useRef, useState } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { WalletProvider, useWallet } from './contexts/WalletContext'
import { ProfileProvider } from './contexts/ProfileContext'
import { usePosts } from './hooks/usePosts'
import { LISTING_CATEGORIES, type ListingCategory } from './config/listingCategories'
import { useConversations, sendListingRefMessage } from './hooks/useMessages'
import { useNotifications } from './hooks/useNotifications'
import { useRouter } from './hooks/useRouter'
import { TREASURY_WALLET } from './hooks/useOrders'
import {
  adminPath,
  homePath,
  marketplacePath,
  messagesPath,
  notificationsPath,
  postPath,
  profilePath,
  questsPath,
  settingsPath,
  verifyPath,
} from './utils/routes'
import { Sidebar, type View } from './components/Sidebar'
import { RightPanel } from './components/RightPanel'
import { PostComposer } from './components/PostComposer'
import { Feed } from './components/Feed'
import { ProfilePage } from './components/ProfilePage'
import { PostPage } from './components/PostPage'
import { GetVerifiedPage } from './components/GetVerifiedPage'
import { QuestsPage } from './components/QuestsPage'
import { MessagesPage } from './components/MessagesPage'
import { MarketplacePage } from './components/MarketplacePage'
import { NotificationsPage } from './components/NotificationsPage'
import { SettingsPage } from './components/SettingsPage'
import { AdminShell } from './components/admin/AdminShell'
import { ConnectWallet } from './components/ConnectWallet'
import { BellIcon, BriefcaseIcon, FeatherIcon, LogoMark, SettingsIcon } from './components/icons'
import { focusComposer } from './utils/composer'
import { shortenAddress } from './utils/avatar'
import './index.css'

function AppShell() {
  const { walletAddress } = useWallet()
  const { posts, loading, error, refresh } = usePosts()
  const { totalUnread } = useConversations()
  const { unreadCount: unreadNotifications } = useNotifications()
  const [searchQuery, setSearchQuery] = useState('')
  const [feedFilter, setFeedFilter] = useState<'all' | 'posts' | 'listings'>('all')
  const [listingCategoryFilter, setListingCategoryFilter] = useState<ListingCategory[]>([])
  const { route, navigate } = useRouter()
  const isTreasury = Boolean(walletAddress) && walletAddress === TREASURY_WALLET

  function visitProfile(walletAddress: string) {
    navigate(profilePath(walletAddress))
  }

  function visitPost(postId: string) {
    navigate(postPath(postId))
  }

  function goToOwnProfile() {
    navigate(profilePath())
  }

  async function messageWallet(walletAddress_: string, postId?: string) {
    if (postId && walletAddress) {
      try {
        await sendListingRefMessage(walletAddress, walletAddress_, postId)
      } catch (e) {
        console.error('[MUSYAWARAH] Gagal ngirim kartu listing otomatis:', e)
      }
    }
    navigate(messagesPath(walletAddress_))
  }

  function goHome() {
    navigate(homePath())
  }

  const sidebarView: View | 'post' = route.view
  const headerTitle =
    route.view === 'home'
      ? 'Home'
      : route.view === 'notifications'
        ? 'Notifications'
        : route.view === 'messages'
          ? 'Messages'
          : route.view === 'verify'
            ? 'Get Verified'
            : route.view === 'quests'
              ? 'Quests'
              : route.view === 'settings'
                ? 'Settings'
                : route.view === 'admin'
                  ? 'Admin'
                  : route.view === 'marketplace'
                    ? 'Marketplace'
                    : route.view === 'post'
                      ? 'Post'
                      : route.wallet
                        ? shortenAddress(route.wallet)
                        : 'Profile'

  function handleSidebarNavigate(v: View) {
    if (v === 'profile') {
      goToOwnProfile()
      return
    }
    if (v === 'home') navigate(homePath())
    else if (v === 'notifications') navigate(notificationsPath())
    else if (v === 'messages') navigate(messagesPath())
    else if (v === 'verify') navigate(verifyPath())
    else if (v === 'quests') navigate(questsPath())
    else if (v === 'settings') navigate(settingsPath())
    else if (v === 'marketplace') navigate(marketplacePath())
    else if (v === 'admin') navigate(adminPath())
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-[1280px] grid-cols-1 items-start md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[275px_minmax(0,600px)_350px]">
      <Sidebar
        view={sidebarView}
        onNavigate={handleSidebarNavigate}
        unreadMessages={totalUnread}
        unreadNotifications={unreadNotifications}
        isTreasury={isTreasury}
      />

      <main className="min-h-screen border-surface-border pb-20 md:border-x md:pb-0">
        <header className="sticky top-0 z-10 hidden border-b border-surface-border bg-base/80 px-4 py-3 backdrop-blur-xl md:block">
          <h1 className="m-0 font-display text-[19px] font-bold tracking-tight text-ink">{headerTitle}</h1>
        </header>

        {route.view === 'home' ? (
          <>
            <PostComposer onPosted={refresh} onGetVerified={() => navigate(verifyPath())} />
            <div className="mx-4 mb-1 flex gap-1 border-b border-surface-border">
              <button
                type="button"
                className={`px-3 pb-2.5 text-[14px] font-semibold transition-colors ${
                  feedFilter === 'all'
                    ? 'border-b-2 border-brand-violetSoft text-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
                onClick={() => {
                  setFeedFilter('all')
                  setListingCategoryFilter([])
                }}
              >
                All
              </button>
              <button
                type="button"
                className={`px-3 pb-2.5 text-[14px] font-semibold transition-colors ${
                  feedFilter === 'posts'
                    ? 'border-b-2 border-brand-violetSoft text-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
                onClick={() => {
                  setFeedFilter('posts')
                  setListingCategoryFilter([])
                }}
              >
                Posts
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 pb-2.5 text-[14px] font-semibold transition-colors ${
                  feedFilter === 'listings'
                    ? 'border-b-2 border-gold text-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
                onClick={() => setFeedFilter('listings')}
              >
                <BriefcaseIcon size={14} />
                Listings
              </button>
            </div>
            {feedFilter === 'listings' && (
              <div className="mx-4 mb-3 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
                    listingCategoryFilter.length === 0
                      ? 'border-gold bg-gold/10 text-ink'
                      : 'border-surface-border text-ink-muted hover:text-ink'
                  }`}
                  onClick={() => setListingCategoryFilter([])}
                >
                  All categories
                </button>
                {LISTING_CATEGORIES.map((category) => {
                  const active = listingCategoryFilter.includes(category)
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={active}
                      className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
                        active
                          ? 'border-gold bg-gold/10 text-ink'
                          : 'border-surface-border text-ink-muted hover:text-ink'
                      }`}
                      onClick={() =>
                        setListingCategoryFilter((prev) =>
                          prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
                        )
                      }
                    >
                      {category}
                    </button>
                  )
                })}
              </div>
            )}
            <Feed
              posts={
                feedFilter === 'listings'
                  ? posts.filter(
                      (p) =>
                        p.is_listing &&
                        p.listing_active &&
                        (listingCategoryFilter.length === 0 ||
                          (p.listing_category !== null && listingCategoryFilter.includes(p.listing_category as ListingCategory)))
                    )
                  : feedFilter === 'posts'
                    ? posts.filter((p) => !p.is_listing)
                    : posts
              }
              loading={loading}
              error={error}
              onTipped={refresh}
              onDeleted={refresh}
              onVisitProfile={visitProfile}
              onVisitPost={visitPost}
              onMessageProvider={messageWallet}
              emptyMessage={
                feedFilter === 'listings'
                  ? listingCategoryFilter.length > 0
                    ? `No listings in ${listingCategoryFilter.map((c) => `"${c}"`).join(', ')}. Try another category.`
                    : 'No skill listings yet. Be the first to post one.'
                  : feedFilter === 'posts'
                    ? 'No posts yet. Be the first.'
                    : undefined
              }
            />
          </>
        ) : route.view === 'notifications' ? (
          <NotificationsPage onVisitProfile={visitProfile} />
        ) : route.view === 'messages' ? (
          <MessagesPage
            openWallet={route.wallet ?? null}
            onOpenThread={(w) => navigate(messagesPath(w))}
            onCloseThread={() => navigate(messagesPath(), { replace: true })}
            onVisitProfile={visitProfile}
            onVisitPost={visitPost}
          />
        ) : route.view === 'verify' ? (
          <div className="px-4 pt-4">
            <GetVerifiedPage onBack={goHome} />
          </div>
        ) : route.view === 'quests' ? (
          <div className="px-4 pt-4">
            <QuestsPage onBack={goHome} />
          </div>
        ) : route.view === 'settings' ? (
          <div className="px-4 pt-4">
            <SettingsPage onBack={goHome} />
          </div>
        ) : route.view === 'marketplace' ? (
          <div className="px-4 pt-4">
            <MarketplacePage
              tab={route.tab ?? 'listings'}
              onChangeTab={(tab) => navigate(marketplacePath(tab))}
              onOpenThread={(wallet) => navigate(messagesPath(wallet))}
              onVisitPost={visitPost}
            />
          </div>
        ) : route.view === 'post' ? (
          <div className="px-4 pt-4">
            <PostPage
              postId={route.postId}
              onBack={goHome}
              onVisitProfile={visitProfile}
              onMessageProvider={messageWallet}
              onChanged={refresh}
            />
          </div>
        ) : route.view === 'admin' ? null : (
          <div className="px-4 pt-4">
            <ProfilePage
              walletAddress={route.wallet}
              onChanged={refresh}
              onMessage={messageWallet}
              onGetVerified={() => navigate(verifyPath())}
              onVisitPost={visitPost}
              onBack={route.wallet ? goHome : undefined}
            />
          </div>
        )}
      </main>

      <RightPanel
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onVisitProfile={visitProfile}
        onVisitPost={(_walletAddress, postId) => visitPost(postId)}
      />

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-border bg-base/80 px-4 py-2.5 backdrop-blur-xl md:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-black">
          <LogoMark size={20} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              route.view === 'notifications' ? 'bg-surface-hover text-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
            }`}
            onClick={() => navigate(notificationsPath())}
            aria-label="Notifications"
          >
            <BellIcon size={19} filled={route.view === 'notifications'} />
            {unreadNotifications > 0 && (
              <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-notify" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              route.view === 'settings' ? 'bg-surface-hover text-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
            }`}
            onClick={() => navigate(settingsPath())}
            aria-label="Settings"
          >
            <SettingsIcon size={19} filled={route.view === 'settings'} />
          </button>
          <ConnectWallet />
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-surface-border bg-surface/90 backdrop-blur-xl md:hidden">
        <button
          className={`flex flex-1 items-center justify-center py-3 text-[15px] font-bold transition-colors ${
            route.view === 'home' ? 'text-brand-violetSoft' : 'text-ink-muted'
          }`}
          onClick={goHome}
        >
          Home
        </button>
        <button
          className={`flex flex-1 items-center justify-center py-3 text-[15px] font-bold transition-colors ${
            route.view === 'profile' ? 'text-brand-violetSoft' : 'text-ink-muted'
          }`}
          onClick={goToOwnProfile}
        >
          Profile
        </button>
        <button
          className={`relative flex flex-1 items-center justify-center py-3 text-[15px] font-bold transition-colors ${
            route.view === 'messages' ? 'text-brand-violetSoft' : 'text-ink-muted'
          }`}
          onClick={() => navigate(messagesPath())}
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
            route.view === 'verify' ? 'text-brand-violetSoft' : 'text-ink-muted'
          }`}
          onClick={() => navigate(verifyPath())}
        >
          Verify
        </button>
      </nav>

      <button
        className="fixed bottom-[76px] right-5 z-[25] flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-accent-contrast shadow-glow transition-transform duration-150 hover:scale-105 active:scale-95 md:hidden"
        onClick={() => {
          if (route.view !== 'home') {
            navigate(homePath())
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

function AppRoot() {
  const { route, navigate } = useRouter()
  const { walletAddress, isAutoConnecting } = useWallet()
  const isTreasury = Boolean(walletAddress) && walletAddress === TREASURY_WALLET
  const hasAutoRedirected = useRef(false)

  useEffect(() => {
    if (hasAutoRedirected.current) return
    if (isAutoConnecting) return
    if (route.view === 'home' && isTreasury) {
      hasAutoRedirected.current = true
      navigate(adminPath(), { replace: true })
    }
  }, [isAutoConnecting, isTreasury, route.view, navigate])

  if (route.view === 'admin') {
    return <AdminShell onExit={() => navigate(homePath())} />
  }

  return <AppShell />
}

export default function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <ProfileProvider>
          <AppRoot />
        </ProfileProvider>
      </WalletProvider>
    </ThemeProvider>
  )
}
