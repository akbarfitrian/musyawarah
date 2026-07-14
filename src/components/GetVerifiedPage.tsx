import { useState } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { useVerification } from '../hooks/useVerification'
import { usePostQuota } from '../hooks/usePostQuota'
import {
  TIER_CONFIG,
  TIER_ORDER,
  tierRank,
  priceForInterval,
  ANNUAL_DISCOUNT,
  type BillingInterval,
  type VerificationTier,
} from '../lib/verification'
import { ChevronLeftIcon } from './icons'
import { VerifiedBadge } from './VerifiedBadge'

const PAID_TIERS = TIER_ORDER.filter((t) => t !== 'none') as Exclude<VerificationTier, 'none'>[]

const CARD_ACCENT: Record<Exclude<VerificationTier, 'none'>, string> = {
  verified: 'border-brand-violet/30 hover:border-brand-violet/60',
  verified_pro: 'border-gold/30 hover:border-gold/60',
  verified_max: 'border-indigo-500/50 hover:border-indigo-500/80',
}

const BUY_BUTTON_ACCENT: Record<Exclude<VerificationTier, 'none'>, string> = {
  verified: 'bg-brand-gradient text-accent-contrast shadow-glow',
  verified_pro: 'bg-gradient-to-r from-gold to-amber-400 text-white shadow-[0_0_0_1px_rgba(217,119,6,0.35)]',
  verified_max: 'bg-gradient-to-r from-indigo-500 to-indigo-700 text-white shadow-[0_0_0_1px_rgba(79,70,229,0.4)]',
}

function tierFeatureLines(tier: Exclude<VerificationTier, 'none'>): string[] {
  const config = TIER_CONFIG[tier]
  const quota =
    config.dailyPostLimit === null
      ? 'Unlimited posts per day'
      : `Post up to ${config.dailyPostLimit}x per day`
  const chars = `Posts up to ${config.maxPostChars.toLocaleString('en-US')} characters`
  const lines = [config.badgeDescription, quota, chars]
  if (config.canAttachImage) lines.push('Attach images to your posts')
  if (config.canEditPost) lines.push('Edit posts after sending')
  return lines
}

function formatExpiryInfo(expiresAtIso: string): { text: string; urgent: boolean } {
  const expiresAtDate = new Date(expiresAtIso)
  const daysLeft = Math.ceil((expiresAtDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const dateLabel = expiresAtDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const daysLabel =
    daysLeft <= 0 ? 'expires today' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`
  return { text: `Expires ${dateLabel} · ${daysLabel}`, urgent: daysLeft <= 3 }
}

export function GetVerifiedPage({ onBack }: { onBack?: () => void }) {
  const { walletAddress, connecting, connect } = useWallet()
  const {
    tier: currentTier,
    billingInterval: currentBillingInterval,
    expiresAt,
    loading: tierLoading,
    purchasingTier,
    error,
    purchase,
  } = useVerification()
  const { usedToday, limit, remaining, loading: quotaLoading } = usePostQuota(walletAddress, currentTier)
  const [justPurchased, setJustPurchased] = useState<VerificationTier | null>(null)
  const [interval, setInterval] = useState<BillingInterval>('yearly')

  async function handleBuy(tier: VerificationTier) {
    setJustPurchased(null)
    try {
      await purchase(tier, interval)
      setJustPurchased(tier)
    } catch {
    }
  }

  return (
    <div>
      {onBack && (
        <button
          type="button"
          className="mb-4 flex items-center gap-1.5 text-[14px] font-medium text-ink-muted transition-colors hover:text-ink"
          onClick={onBack}
        >
          <ChevronLeftIcon size={16} />
          Back
        </button>
      )}

      <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <h1 className="m-0 font-display text-[22px] font-bold text-ink">Get Verified</h1>
          <span
            className="cursor-help rounded-full bg-surface-hover px-2 py-1 text-[11px] font-medium text-ink-faint"
            title="Pay with UCT to unlock a badge, post more often, write longer posts, and (on higher tiers) attach images or edit posts. Daily post quotas reset at 00:00 UTC. Payment goes straight from your wallet — same flow as sending a tip. Tiers don't stack: buying a new tier replaces your current one. Yearly plans are billed once for 12 months at a 15% discount versus paying monthly."
          >
            How it works
          </span>
        </div>

        {!walletAddress ? (
          <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-surface-border bg-base px-4 py-3">
            <p className="text-[14px] text-ink-muted">Connect your wallet to see your status and buy a tier.</p>
            <button
              className="rounded-full bg-brand-gradient px-5 py-2 text-[14px] font-semibold text-accent-contrast shadow-glow transition-transform duration-150 hover:scale-[1.03] active:scale-95 disabled:opacity-60"
              onClick={connect}
              disabled={connecting}
            >
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-surface-border bg-base px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-medium text-ink-muted">Your status:</span>
              {tierLoading ? (
                <span className="text-[13px] text-ink-faint">Loading…</span>
              ) : currentTier === 'none' ? (
                <span className="text-[13px] font-semibold text-ink">Free</span>
              ) : (
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  {TIER_CONFIG[currentTier].label}
                  <VerifiedBadge tier={currentTier} size={15} />
                </span>
              )}
              <span className="text-ink-faint">·</span>
              <span className="text-[13px] text-ink-muted">
                {quotaLoading
                  ? 'Loading today’s quota…'
                  : limit === null
                    ? `${usedToday} posts today (unlimited)`
                    : `${usedToday}/${limit} posts today · ${remaining} left`}
              </span>
            </div>

            {currentTier !== 'none' && currentBillingInterval && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-surface-border pt-2">
                <span className="text-[13px] text-ink-muted">
                  {currentBillingInterval === 'yearly' ? 'Yearly' : 'Monthly'} plan
                </span>
                {expiresAt && (
                  <>
                    <span className="text-ink-faint">·</span>
                    {(() => {
                      const { text, urgent } = formatExpiryInfo(expiresAt)
                      return (
                        <span className={`text-[13px] font-medium ${urgent ? 'text-danger' : 'text-ink-muted'}`}>
                          {text}
                        </span>
                      )
                    })()}
                  </>
                )}
                <span className="basis-full text-[11.5px] text-ink-faint">
                  One-time payment — it won’t auto-renew. Buy again before it expires to keep your badge.
                </span>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
        {justPurchased && (
          <p className="mt-3 text-[13px] font-medium text-brand-violetSoft">
            You’re now {TIER_CONFIG[justPurchased].label}! Your badge should appear right away.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-surface-border bg-surface p-5 shadow-card">
        <h2 className="m-0 font-display text-[15px] font-semibold text-ink">Free</h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          No badge. Post up to {TIER_CONFIG.none.dailyPostLimit}x per day, up to{' '}
          {TIER_CONFIG.none.maxPostChars} characters per post.
        </p>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1 rounded-full border border-surface-border bg-base p-1 text-[13px] font-semibold">
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 transition-colors ${
            interval === 'monthly' ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
          }`}
          onClick={() => setInterval('monthly')}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors ${
            interval === 'yearly' ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
          }`}
          onClick={() => setInterval('yearly')}
        >
          Yearly
          <span className="rounded-full bg-brand-gradient px-2 py-0.5 text-[11px] font-bold text-accent-contrast">
            Save {Math.round(ANNUAL_DISCOUNT * 100)}%
          </span>
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PAID_TIERS.map((tier) => {
          const config = TIER_CONFIG[tier]
          const isCurrent = currentTier === tier
          const isDowngrade = tierRank(tier) < tierRank(currentTier)
          const isBusy = purchasingTier === tier
          const price = priceForInterval(tier, interval)

          return (
            <div
              key={tier}
              className={`flex flex-col rounded-2xl border bg-surface p-5 shadow-card transition-colors ${CARD_ACCENT[tier]}`}
            >
              <div className="flex items-center gap-2">
                <h2 className="m-0 font-display text-[16px] font-bold text-ink">{config.label}</h2>
                <VerifiedBadge tier={tier} size={16} />
              </div>
              <p className="mt-2 font-mono text-[24px] font-bold text-ink">
                {price.toLocaleString('en-US')}{' '}
                <span className="text-[13px] font-medium text-ink-muted">
                  UCT / {interval === 'yearly' ? 'year' : 'month'}
                </span>
              </p>
              <ul className="mt-3 flex flex-1 flex-col gap-2">
                {tierFeatureLines(tier).map((line) => (
                  <li key={line} className="flex items-start gap-2 text-[13px] text-ink-muted">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-faint" />
                    {line}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className={`mt-4 rounded-full px-4 py-2.5 text-[14px] font-semibold transition-transform duration-150 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${BUY_BUTTON_ACCENT[tier]}`}
                onClick={() => handleBuy(tier)}
                disabled={!walletAddress || (isCurrent && currentBillingInterval === interval) || isBusy || purchasingTier !== null}
              >
                {!walletAddress
                  ? 'Connect wallet first'
                  : isBusy
                    ? 'Sending payment…'
                    : isCurrent && currentBillingInterval === interval
                      ? 'Current plan'
                      : isCurrent
                        ? `Switch to ${interval === 'yearly' ? 'yearly' : 'monthly'}`
                        : isDowngrade
                          ? `Switch to ${config.label}`
                          : `Get ${config.label}`}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
