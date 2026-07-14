
export type VerificationTier = 'none' | 'verified' | 'verified_pro' | 'verified_max'

export type BillingInterval = 'monthly' | 'yearly'

export const ANNUAL_DISCOUNT = 0.15

export interface TierConfig {
  tier: VerificationTier
  label: string
  monthlyPriceUct: number
  dailyPostLimit: number | null
  maxPostChars: number
  canAttachImage: boolean
  canEditPost: boolean
  badgeDescription: string
}

export const TIER_ORDER: VerificationTier[] = ['none', 'verified', 'verified_pro', 'verified_max']

export const TIER_CONFIG: Record<VerificationTier, TierConfig> = {
  none: {
    tier: 'none',
    label: 'Free',
    monthlyPriceUct: 0,
    dailyPostLimit: 1,
    maxPostChars: 60,
    canAttachImage: false,
    canEditPost: false,
    badgeDescription: 'No badge',
  },
  verified: {
    tier: 'verified',
    label: 'Verified',
    monthlyPriceUct: 30,
    dailyPostLimit: 2,
    maxPostChars: 150,
    canAttachImage: false,
    canEditPost: false,
    badgeDescription: 'Blue checkmark',
  },
  verified_pro: {
    tier: 'verified_pro',
    label: 'Verified Pro',
    monthlyPriceUct: 50,
    dailyPostLimit: 2,
    maxPostChars: 250,
    canAttachImage: true,
    canEditPost: false,
    badgeDescription: 'Gold checkmark',
  },
  verified_max: {
    tier: 'verified_max',
    label: 'Verified Max',
    monthlyPriceUct: 100,
    dailyPostLimit: 3,
    maxPostChars: 350,
    canAttachImage: true,
    canEditPost: true,
    badgeDescription: 'Indigo checkmark',
  },
}

export function dailyPostLimit(tier: VerificationTier | null | undefined): number | null {
  return TIER_CONFIG[tier ?? 'none'].dailyPostLimit
}

export function maxPostChars(tier: VerificationTier | null | undefined): number {
  return TIER_CONFIG[tier ?? 'none'].maxPostChars
}

export function canAttachImage(tier: VerificationTier | null | undefined): boolean {
  return TIER_CONFIG[tier ?? 'none'].canAttachImage
}

export function canEditPost(tier: VerificationTier | null | undefined): boolean {
  return TIER_CONFIG[tier ?? 'none'].canEditPost
}

export function tierRank(tier: VerificationTier): number {
  return TIER_ORDER.indexOf(tier)
}

export function yearlyPriceUct(tier: VerificationTier): number {
  const monthly = TIER_CONFIG[tier].monthlyPriceUct
  return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT))
}

export function priceForInterval(tier: VerificationTier, interval: BillingInterval): number {
  return interval === 'yearly' ? yearlyPriceUct(tier) : TIER_CONFIG[tier].monthlyPriceUct
}

export function yearlySavingsUct(tier: VerificationTier): number {
  const monthly = TIER_CONFIG[tier].monthlyPriceUct
  return monthly * 12 - yearlyPriceUct(tier)
}

export function computeExpiresAtIso(interval: BillingInterval, from: Date = new Date()): string {
  const next = new Date(from)
  if (interval === 'yearly') {
    next.setUTCFullYear(next.getUTCFullYear() + 1)
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1)
  }
  return next.toISOString()
}

export function startOfUtcDayIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}
