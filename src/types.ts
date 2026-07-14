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
  billing_interval: BillingInterval | null
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
  edited_at?: string | null
  is_listing: boolean
  listing_title: string | null
  listing_category: string | null
  listing_price_amount: number | null
  listing_price_mode: ListingPriceMode | null
  listing_coin_symbol: string | null
  listing_active: boolean
  tip_total?: number
  author_avatar_url?: string | null
  repost_total?: number
  reposted_by_me?: boolean
  reposted_by_wallet?: string
  author_verification_tier?: VerificationTier
  order_count?: number
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
  order_id?: string
}

export type OrderStatus =
  | 'pending'
  | 'locking'
  | 'locked'
  | 'completed'
  | 'released'
  | 'disputed'
  | 'cancelled'
  | 'refunded'

export interface OrderUpdatePayload {
  order_id: string
  status: OrderStatus
  deliverable_url?: string
}

export interface Message {
  id: string
  sender_wallet: string
  receiver_wallet: string
  content: string
  read: boolean
  deleted: boolean
  created_at: string
  kind: MessageKind
  payload: ListingRefPayload | OfferPayload | OrderUpdatePayload | null
}

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
  locking_at: string | null
  locked_at: string | null
  completed_at: string | null
  released_at: string | null
  cancelled_at: string | null
  deliverable_url: string | null
  delivered_at: string | null
  disputed_at: string | null
  dispute_reason: 'seller_no_delivery_24h' | 'buyer_quality_dispute' | null
  dispute_note: string | null
  dispute_used: boolean
  completion_reason: 'buyer_no_confirm_72h' | null
  refund_flagged_at: string | null
  refunded_at: string | null
}

export interface Review {
  id: string
  order_id: string
  reviewer_wallet: string
  reviewee_wallet: string
  rating: number
  comment: string | null
  created_at: string
}

export interface ProviderReputation {
  avg_rating: number
  review_count: number
}

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
  wallet_address: string
  last_message: Message
  unread_count: number
  avatar_url: string | null
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
  recipient_wallet: string
  actor_wallet: string
  type: NotificationType
  post_id: string | null
  amount: number | null
  order_id: string | null
  body: string | null
  read: boolean
  created_at: string
  actor_avatar_url?: string | null
  actor_verification_tier?: VerificationTier
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
  coingeckoId: string | null
  symbol: string
  name: string
  price: number
  change24h: number | null
  logoUrl: string | null
  isCustom: boolean
}
