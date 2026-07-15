
export type Route =
  | { view: 'home' }
  | { view: 'notifications' }
  | { view: 'messages'; wallet?: string }
  | { view: 'verify' }
  | { view: 'quests' }
  | { view: 'settings' }
  | { view: 'profile'; wallet?: string }
  | { view: 'post'; postId: string }
  | { view: 'marketplace'; tab?: 'listings' | 'orders' }
  | { view: 'admin' }

export function homePath() {
  return '/home'
}
export function notificationsPath() {
  return '/notifications'
}
export function messagesPath(wallet?: string) {
  return wallet ? `/messages/${encodeURIComponent(wallet)}` : '/messages'
}
export function verifyPath() {
  return '/verify'
}
export function questsPath() {
  return '/quests'
}
export function marketplacePath(tab?: 'listings' | 'orders') {
  return tab ? `/marketplace/${tab}` : '/marketplace'
}
export function settingsPath() {
  return '/settings'
}
export function adminPath() {
  return '/admin'
}
// Wallet-specific profiles get the Twitter/X-style "/@handle" shape.
// No-wallet ("my profile") keeps the plain "/profile" path.
export function profilePath(wallet?: string) {
  return wallet ? `/@${encodeURIComponent(wallet)}` : '/profile'
}
export function postPath(postId: string) {
  return `/post/${encodeURIComponent(postId)}`
}

export function parsePath(pathname: string): Route {
  const path = pathname || '/'
  const [seg1, seg2] = path.split('/').filter(Boolean)

  // "/@handle" -> profile. Checked first since "@" isn't a reserved segment.
  if (seg1 && seg1.startsWith('@')) {
    const wallet = seg1.slice(1)
    return { view: 'profile', wallet: wallet ? decodeURIComponent(wallet) : undefined }
  }

  switch (seg1) {
    case undefined:
    case 'home':
      return { view: 'home' }
    case 'notifications':
      return { view: 'notifications' }
    case 'messages':
      return { view: 'messages', wallet: seg2 ? decodeURIComponent(seg2) : undefined }
    case 'verify':
      return { view: 'verify' }
    case 'quests':
      return { view: 'quests' }
    case 'marketplace':
      return { view: 'marketplace', tab: seg2 === 'orders' ? 'orders' : seg2 === 'listings' ? 'listings' : undefined }
    case 'settings':
      return { view: 'settings' }
    case 'admin':
      return { view: 'admin' }
    case 'profile':
      return { view: 'profile', wallet: seg2 ? decodeURIComponent(seg2) : undefined }
    case 'post':
      return seg2 ? { view: 'post', postId: decodeURIComponent(seg2) } : { view: 'home' }
    default:
      return { view: 'home' }
  }
}

export function absoluteUrl(path: string) {
  return `${window.location.origin}${path}`
}
