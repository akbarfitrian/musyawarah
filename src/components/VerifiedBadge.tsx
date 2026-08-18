import type { VerificationTier } from '../lib/verification'
import { TIER_CONFIG, TIER_ACCENT } from '../lib/verification'
import { VerifiedCheckIcon } from './icons'

const CHECK_COLOR: Record<'verified' | 'verified_pro' | 'verified_max', string> = {
  verified: TIER_ACCENT.verified.base,
  verified_pro: TIER_ACCENT.verified_pro.base,
  verified_max: TIER_ACCENT.verified_max.base,
}

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
