// ============================================================================
// VERIFICATION TIERS -- "centang biru / emas / berlian" beli pakai UCT
// ----------------------------------------------------------------------------
// Ini SATU-SATUNYA sumber kebenaran buat harga, badge, kuota posting, batas
// karakter, dan fitur (gambar/edit) tiap tier. Kalau mau ubah harga atau
// kuota, ubah di sini aja -- UI (GetVerifiedPage, PostComposer, PostCard,
// VerifiedBadge) semua baca dari sini.
//
// Billing sekarang ada 2 pilihan: bulanan (monthly) atau tahunan (yearly).
// Tahunan dapet diskon ANNUAL_DISCOUNT (15%) dibanding bayar bulanan x12.
//
// Pembayarannya lewat sendTip() yang sama dipakai buat tip ke post (lihat
// WalletContext.tsx), cuma tujuannya bukan post author tapi wallet treasury
// platform (VITE_VERIFICATION_TREASURY_WALLET di .env.local).
// ============================================================================

export type VerificationTier = 'none' | 'verified' | 'verified_pro' | 'verified_max'

export type BillingInterval = 'monthly' | 'yearly'

/** Diskon buat langganan tahunan, dibanding bayar bulanan x12. 0.15 = 15%. */
export const ANNUAL_DISCOUNT = 0.15

export interface TierConfig {
  tier: VerificationTier
  /** Nama yang ditampilin di UI. */
  label: string
  /** Harga dalam UCT per bulan buat tier ini. 0 buat "none" (free, bukan dijual). */
  monthlyPriceUct: number
  /** Kuota posting per hari, reset jam 00:00 UTC. null = tanpa batas. */
  dailyPostLimit: number | null
  /** Batas maksimal karakter per post buat tier ini. */
  maxPostChars: number
  /** Boleh nyisipin gambar ke post atau nggak. */
  canAttachImage: boolean
  /** Boleh ngedit post yang udah dikirim atau nggak. */
  canEditPost: boolean
  /** Deskripsi singkat badge-nya, buat tooltip & halaman "Get Verified". */
  badgeDescription: string
}

/** Urutan dari yang paling rendah ke paling tinggi -- dipakai buat nge-render
 * daftar tier di halaman "Get Verified" dan buat cek "upgrade vs downgrade". */
export const TIER_ORDER: VerificationTier[] = ['none', 'verified', 'verified_pro', 'verified_max']

export const TIER_CONFIG: Record<VerificationTier, TierConfig> = {
  none: {
    tier: 'none',
    label: 'Free',
    monthlyPriceUct: 0,
    dailyPostLimit: 1,
    maxPostChars: 100,
    canAttachImage: false,
    canEditPost: false,
    badgeDescription: 'No badge',
  },
  verified: {
    tier: 'verified',
    label: 'Verified',
    monthlyPriceUct: 30,
    dailyPostLimit: 3,
    maxPostChars: 300,
    canAttachImage: false,
    canEditPost: false,
    badgeDescription: 'Blue checkmark',
  },
  verified_pro: {
    tier: 'verified_pro',
    label: 'Verified Pro',
    monthlyPriceUct: 50,
    dailyPostLimit: 5,
    maxPostChars: 500,
    canAttachImage: true,
    canEditPost: false,
    badgeDescription: 'Gold checkmark',
  },
  verified_max: {
    tier: 'verified_max',
    label: 'Verified Max',
    monthlyPriceUct: 100,
    dailyPostLimit: 10,
    maxPostChars: 1000,
    canAttachImage: true,
    canEditPost: true,
    badgeDescription: 'Indigo checkmark',
  },
}

/** Kuota posting per hari buat tier tertentu. null = tanpa batas. */
export function dailyPostLimit(tier: VerificationTier | null | undefined): number | null {
  return TIER_CONFIG[tier ?? 'none'].dailyPostLimit
}

/** Batas maksimal karakter per post buat tier tertentu. */
export function maxPostChars(tier: VerificationTier | null | undefined): number {
  return TIER_CONFIG[tier ?? 'none'].maxPostChars
}

/** Boleh nyisipin gambar ke post atau nggak buat tier tertentu. */
export function canAttachImage(tier: VerificationTier | null | undefined): boolean {
  return TIER_CONFIG[tier ?? 'none'].canAttachImage
}

/** Boleh ngedit post yang udah dikirim atau nggak buat tier tertentu. */
export function canEditPost(tier: VerificationTier | null | undefined): boolean {
  return TIER_CONFIG[tier ?? 'none'].canEditPost
}

export function tierRank(tier: VerificationTier): number {
  return TIER_ORDER.indexOf(tier)
}

/** Harga tahunan (UCT) buat tier tertentu, udah dipotong ANNUAL_DISCOUNT
 * dibanding bayar bulanan x12. Dibulatin ke integer terdekat. */
export function yearlyPriceUct(tier: VerificationTier): number {
  const monthly = TIER_CONFIG[tier].monthlyPriceUct
  return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT))
}

/** Harga (UCT) buat beli/perpanjang tier tertentu, sesuai interval billing-nya. */
export function priceForInterval(tier: VerificationTier, interval: BillingInterval): number {
  return interval === 'yearly' ? yearlyPriceUct(tier) : TIER_CONFIG[tier].monthlyPriceUct
}

/** Berapa UCT yang dihemat kalau pilih tahunan dibanding bulanan x12. */
export function yearlySavingsUct(tier: VerificationTier): number {
  const monthly = TIER_CONFIG[tier].monthlyPriceUct
  return monthly * 12 - yearlyPriceUct(tier)
}

/** ISO timestamp buat tanggal berakhirnya langganan, dihitung dari sekarang
 * (atau dari `from` kalau dikasih) + 1 bulan / 1 tahun sesuai interval. */
export function computeExpiresAtIso(interval: BillingInterval, from: Date = new Date()): string {
  const next = new Date(from)
  if (interval === 'yearly') {
    next.setUTCFullYear(next.getUTCFullYear() + 1)
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1)
  }
  return next.toISOString()
}

/** ISO timestamp buat awal hari ini di UTC -- dipakai buat query "berapa post
 * yang udah dibikin wallet ini hari ini", karena kuota reset jam 00:00 UTC. */
export function startOfUtcDayIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}
