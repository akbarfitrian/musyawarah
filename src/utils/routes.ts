/**
 * Router super ringan berbasis hash (#/profile/0x123, #/post/abc, dst) --
 * nggak butuh library tambahan (react-router) dan otomatis jalan di hosting
 * static apa pun (nggak perlu rewrite rule server), termasuk pas MUSYAWARAH
 * dimuat sebagai iframe (lihat catatan di PostCard.tsx soal Sphere Agent).
 *
 * Setiap profil, post, dan thread DM sekarang punya alamat sendiri yang bisa
 * di-copy/share/bookmark -- sama kayak /wallet, /status/123, /messages/wallet
 * di X/Twitter.
 */

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
  return '/'
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
export function profilePath(wallet?: string) {
  return wallet ? `/profile/${encodeURIComponent(wallet)}` : '/profile'
}
export function postPath(postId: string) {
  return `/post/${encodeURIComponent(postId)}`
}

export function parseHash(hash: string): Route {
  // "#/profile/0x123" -> "/profile/0x123" -> ["profile", "0x123"]
  const path = hash.replace(/^#/, '') || '/'
  const [seg1, seg2] = path.split('/').filter(Boolean)

  switch (seg1) {
    case undefined:
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

/** Alamat lengkap yang bisa di-copy/share buat suatu path (mis. hasil dari
 * profilePath()/postPath()/messagesPath()). */
export function absoluteUrl(path: string) {
  return `${window.location.origin}${window.location.pathname}${window.location.search}#${path}`
}
