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

export type ListingPriceMode = 'task' | 'subscription'

export interface Post {
  id: string
  author_wallet: string
  content: string
  image_url: string | null
  created_at: string
  /** Keisi (ISO timestamp) kalau post ini pernah diedit sesudah dikirim.
   * Cuma tier Verified Max yang boleh ngedit -- lihat lib/verification.ts. */
  edited_at?: string | null
  // --- Marketplace (draft §1a) — Fase 1: listing sebagai varian post ---
  /** True kalau post ini juga adalah listing jasa/skill (marketplace). */
  is_listing: boolean
  listing_title: string | null
  listing_category: string | null
  listing_price_amount: number | null
  listing_price_mode: ListingPriceMode | null
  listing_coin_symbol: string | null
  /** Provider bisa nonaktifin listing tanpa hapus post-nya (fitur Fase 4,
   * kolomnya udah ada dari sekarang). */
  listing_active: boolean
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
  /** Jumlah baris `orders` yang nge-reference post ini, APAPUN statusnya
   * (termasuk 'cancelled' -- barisnya tetap ada, cuma status-nya berubah).
   * Cuma keisi buat listing. Dipakai buat nge-gate tombol Delete: `orders.
   * post_id` punya FK `on delete restrict`, jadi begitu angkanya > 0, post
   * ini SELAMANYA gak bisa dihapus lewat delete_post() -- lihat
   * 007_marketplace_negotiation.sql:57. */
  order_count?: number
  /** Subset dari order_count -- cuma yang statusnya 'completed' atau
   * 'released' (transaksi yang beneran kelar, bukan cuma pending/cancelled).
   * Dipakai buat badge "X terjual" di kartu listing. */
  completed_order_count?: number
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

// --- Marketplace nego di DM (draft §1b/§2) — Fase 2 ---
export type MessageKind = 'text' | 'listing_ref' | 'offer' | 'order_update'

export interface ListingRefPayload {
  post_id: string
}

export type OfferStatus = 'pending' | 'accepted' | 'declined'

export interface OfferPayload {
  post_id: string
  amount: number
  coin_symbol: string
  status: OfferStatus
  /** Keisi begitu offer di-accept -- id baris `orders` yang otomatis dibuat. */
  order_id?: string
}

/** Fase 2: cuma pernah 'pending' (dibuat pas accept_offer). Status lain
 * ('locked' | 'completed' | 'released' | 'disputed') dipakai mulai Fase 3.
 * 'cancelled' ditambah di 011_cancel_and_supersede_orders.sql -- order
 * 'pending' yang dibatalkan manual (cancel_order) atau otomatis di-supersede
 * pas offer baru buat pasangan post+buyer+provider yang sama di-accept. */
export type OrderStatus = 'pending' | 'locked' | 'completed' | 'released' | 'disputed' | 'cancelled'

export interface OrderUpdatePayload {
  order_id: string
  status: OrderStatus
  /** Cuma keisi di pesan yang dibikin `mark_order_delivered` (015) --
   * link deliverable yang provider taro pas order masih 'locked'. */
  deliverable_url?: string
}

export interface Message {
  id: string
  sender_wallet: string
  receiver_wallet: string
  content: string
  read: boolean
  /** True kalau pesan ini udah dihapus pengirimnya (delete_message, 014) --
   * content-nya udah dikosongin di server, klien render placeholder "Message
   * deleted" buat baris ini. Cuma bisa true buat kind === 'text'. */
  deleted: boolean
  created_at: string
  kind: MessageKind
  payload: ListingRefPayload | OfferPayload | OrderUpdatePayload | null
}

// --- Marketplace orders (draft §1c) — baris di sini cuma pernah berstatus
// 'pending' sampai Fase 3 (lock_escrow_order/dst) ditulis. ---
export interface Order {
  id: string
  post_id: string
  buyer_wallet: string
  provider_wallet: string
  amount: number
  coin_symbol: string
  escrow_wallet: string | null
  lock_tx_hash: string | null
  status: OrderStatus
  created_at: string
  locked_at: string | null
  completed_at: string | null
  released_at: string | null
  cancelled_at: string | null
  /** Link hasil kerjaan yang provider taro (015, `mark_order_delivered`) --
   * null selama belum ada yang diisi. Bentuknya link (Drive/GitHub/Figma/dst)
   * karena platform ini sendiri gak punya file storage buat deliverable.
   * Ditimpa lagi oleh `submit_deliverable_revision` (019) kalau seller balas
   * dispute dengan link baru. */
  deliverable_url: string | null
  delivered_at: string | null
  /** Kapan order ini pindah ke status 'disputed' terakhir kali (017 auto-
   * flag ATAU 019 dispute manual buyer) -- di-NULL-kan lagi begitu seller
   * submit revisi (019), jadi cuma keisi SELAMA order MASIH 'disputed'. */
  disputed_at: string | null
  /** Kenapa order ini disputed -- 'seller_no_delivery_24h' (017, auto,
   * seller nggak submit apa-apa dalam 24 jam) atau 'buyer_quality_dispute'
   * (019, buyer aktif nolak hasil kerjaan). Sama kayak disputed_at, di-NULL-
   * kan lagi begitu seller submit revisi. */
  dispute_reason: 'seller_no_delivery_24h' | 'buyer_quality_dispute' | null
  /** Alasan dispute dalam kata-kata buyer sendiri (019) -- cuma keisi buat
   * dispute_reason 'buyer_quality_dispute', null buat auto-flag 017. */
  dispute_note: string | null
  /** True kalau order ini SUDAH PERNAH dipakai jatah dispute-nya (020) --
   * BEDA dari disputed_at/dispute_reason (yang di-null-kan lagi tiap seller
   * revisi): kolom ini permanen begitu jadi true, dipakai buat nyembunyiin
   * tombol "Dispute" secara permanen meski order balik 'locked' lagi. */
  dispute_used: boolean
  /** 'buyer_no_confirm_72h' kalau order ini di-auto-complete sistem (018)
   * karena buyer nggak kunjung confirm dalam 72 jam sejak delivered_at --
   * null kalau buyer confirm manual sendiri. Dipakai UI buat bedain visual
   * "completed manual" vs "completed otomatis". */
  completion_reason: 'buyer_no_confirm_72h' | null
}

// --- Marketplace reviews (draft §1d) — Fase 4 ---
export interface Review {
  id: string
  order_id: string
  reviewer_wallet: string
  reviewee_wallet: string
  rating: number
  comment: string | null
  created_at: string
}

/** Hasil `get_provider_reputation` RPC -- rata-rata rating + jumlah review
 * buat 1 wallet. `review_count === 0` berarti belum pernah direview. */
export interface ProviderReputation {
  avg_rating: number
  review_count: number
}

/** Ringkasan listing yang dibutuhin buat nampilin kartu `listing_ref`/`offer`
 * di dalam bubble chat -- dikumpulin batch di useThread.ts, bukan kolom asli
 * tabel `messages` (payload cuma nyimpen `post_id`). */
export interface ListingSnapshot {
  id: string
  listing_title: string | null
  listing_category: string | null
  listing_price_amount: number | null
  listing_price_mode: ListingPriceMode | null
  listing_coin_symbol: string | null
  listing_active: boolean
  author_wallet: string
}

export interface Conversation {
  /** Wallet lawan bicara (bukan wallet kita sendiri). */
  wallet_address: string
  last_message: Message
  unread_count: number
  /** Foto profil lawan bicara, kalau ada. */
  avatar_url: string | null
  /** Tier verifikasi lawan bicara (buat badge centang di daftar percakapan). */
  verification_tier?: VerificationTier
}

export interface Follow {
  id: string
  follower_wallet: string
  followed_wallet: string
  created_at: string
}

export type NotificationType = 'follow' | 'repost' | 'tip' | 'order_reminder'

export interface AppNotification {
  id: string
  /** Wallet yang NERIMA notif ini (wallet yang lagi connect, kalau ini punya kita). */
  recipient_wallet: string
  /** Wallet yang NGELAKUIN aksinya (yang follow / repost / tip). */
  actor_wallet: string
  type: NotificationType
  /** Keisi buat repost & tip (post yang direpost/ditip). Null buat follow. */
  post_id: string | null
  /** Keisi buat tip (jumlah UCT) & order_reminder (jumlah order). Null buat follow/repost. */
  amount: number | null
  /** Keisi cuma buat order_reminder (order escrow yang lagi diingetin). Null buat tipe lain. */
  order_id: string | null
  /** Teks detail transaksi yang udah jadi, dikomposisi di server (cuma keisi buat
   * order_reminder -- lihat send_escrow_confirmation_reminders() di 013). Null buat tipe lain. */
  body: string | null
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
