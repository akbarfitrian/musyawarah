import type { VerificationTier } from '../lib/verification'
import { TIER_CONFIG } from '../lib/verification'
import { VerifiedCheckIcon } from './icons'

const CHECK_COLOR: Record<'verified' | 'verified_pro' | 'verified_max', string> = {
  verified: '#2563EB', // centang biru
  verified_pro: '#D97706', // centang emas
  verified_max: '#4F46E5', // centang indigo
}

/**
 * Badge di samping username: centang biru (verified), centang emas
 * (verified_pro), atau centang indigo (verified_max). Nggak render apa-apa
 * buat tier "none" (free) -- biar nggak ada badge kosong di layout.
 */
export function VerifiedBadge({
  tier,
  size = 14,
}: {
  tier: VerificationTier | null | undefined
  size?: number
}) {
  if (!tier || tier === 'none') return null

  const title = TIER_CONFIG[tier].label

  return (
    <span
      className="inline-flex shrink-0 items-center"
      style={{ color: CHECK_COLOR[tier] }}
      title={title}
      aria-label={title}
    >
      <VerifiedCheckIcon size={size} />
    </span>
  )
}
