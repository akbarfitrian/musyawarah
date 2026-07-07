import type { BillingInterval, VerificationTier } from './lib/verification'

export interface Profile {
  wallet_address: string
  username: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
}

export interface Verification {
  wallet_address: string
  tier: 'verified' | 'verified_pro' | 'verified_max'
  amount_paid: number
  /** 'monthly' atau 'yearly' -- interval billing waktu terakhir beli/perpanjang. */
  billing_interval: BillingInterval | null
  /** Kapan langganan ini berakhir (ISO). Null buat baris lama (sebelum fitur billing interval ada). */
  expires_at: string | null
  tx_hash: string | null
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  author_wallet: string
  content: string
  image_url: string | null
  created_at: string
  /** Keisi (ISO timestamp) kalau post ini pernah diedit sesudah dikirim.
   * Cuma tier Verified Max yang boleh ngedit -- lihat lib/verification.ts. */
  edited_at?: string | null
  // computed client-side, bukan kolom asli:
  tip_total?: number
  author_avatar_url?: string | null
  repost_total?: number
  reposted_by_me?: boolean
  /** Keisi kalau post ini nongol di suatu profil karena di-repost (bukan
   * post asli wallet itu). Dipakai buat nampilin badge "Direpost". */
  reposted_by_wallet?: string
  /** Tier verifikasi author-nya ('verified' | 'verified_pro' | 'verified_max'
   * | undefined kalau free) -- dipakai buat nampilin badge centang/berlian
   * di samping username. Lihat src/lib/verification.ts. */
  author_verification_tier?: VerificationTier
}

export interface Tip {
  id: string
  post_id: string
  from_wallet: string
  to_wallet: string
  amount: number
  tx_hash: string | null
  created_at: string
}

export interface Repost {
  id: string
  post_id: string
  wallet_address: string
  created_at: string
}

export interface Message {
  id: string
  sender_wallet: string
  receiver_wallet: string
  content: string
  read: boolean
  created_at: string
}

export interface Conversation {
  /** Wallet lawan bicara (bukan wallet kita sendiri). */
  wallet_address: string
  last_message: Message
  unread_count: number
  /** Foto profil lawan bicara, kalau ada. */
  avatar_url: string | null
}

export interface Follow {
  id: string
  follower_wallet: string
  followed_wallet: string
  created_at: string
}

export type NotificationType = 'follow' | 'repost' | 'tip'

export interface AppNotification {
  id: string
  /** Wallet yang NERIMA notif ini (wallet yang lagi connect, kalau ini punya kita). */
  recipient_wallet: string
  /** Wallet yang NGELAKUIN aksinya (yang follow / repost / tip). */
  actor_wallet: string
  type: NotificationType
  /** Keisi buat repost & tip (post yang direpost/ditip). Null buat follow. */
  post_id: string | null
  /** Keisi cuma buat tip (jumlah UCT). Null buat follow/repost. */
  amount: number | null
  read: boolean
  created_at: string
  // computed client-side, bukan kolom asli -- lihat useNotifications.ts:
  actor_avatar_url?: string | null
  actor_verification_tier?: VerificationTier
  /** Cuplikan konten post terkait (buat notif repost/tip). Null kalau
   * postnya udah kehapus atau notifnya tipe follow. */
  post_preview?: string | null
}

export type QuestLevel = 'easy' | 'medium' | 'hard'

export interface QuestBoardRow {
  quest_id: string
  title: string
  description: string
  level: QuestLevel
  points: number
  order_index: number
  unlock_after: string | null
  unlock_after_order: number | null
  verify_label: string
  completed: boolean
  completed_at: string | null
  unlocked: boolean
}

export type TopTippedPeriod = 'weekly' | 'all_time'

export interface TopTippedRow {
  wallet_address: string
  username: string | null
  avatar_url: string | null
  verification_tier: VerificationTier
  total_amount: number
}

export interface TopTippedPostRow {
  post_id: string
  content: string
  author_wallet: string
  username: string | null
  avatar_url: string | null
  verification_tier: VerificationTier
  total_amount: number
}

export interface AssetPrice {
  /** ID CoinGecko (mis. 'bitcoin') buat token yang harganya/logo-nya live
   * dari API. null buat token custom (UCT/USDU) yang di-hardcode. */
  coingeckoId: string | null
  symbol: string
  name: string
  price: number
  change24h: number | null
  logoUrl: string | null
  /** Token custom Unicity (UCT/USDU) -- harga tetap $1, logo "$" abu-abu. */
  isCustom: boolean
}
