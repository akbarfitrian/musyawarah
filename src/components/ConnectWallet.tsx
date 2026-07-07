import { useState } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { useProfile } from '../contexts/ProfileContext'
import { useVerification } from '../hooks/useVerification'
import { avatarColor, avatarInitial, shortenAddress } from '../utils/avatar'
import { ChevronDownIcon, LogoutIcon, RefreshIcon } from './icons'
import { VerifiedBadge } from './VerifiedBadge'
import { fromBaseUnits, type SphereConnectionMode, type WalletAsset } from '../lib/sphereConnect'

const MODE_LABEL: Record<SphereConnectionMode, string> = {
  iframe: 'via Sphere',
  extension: 'via extension',
  popup: 'via popup',
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Angka amount token, dipotong maks 4 desimal biar nggak kepanjangan di dropdown. */
function formatAmount(amountBase: string, decimals: number): string {
  const value = Number(fromBaseUnits(amountBase, decimals))
  if (Number.isNaN(value)) return fromBaseUnits(amountBase, decimals)
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

/**
 * Total portofolio buat tampilan ringkas di sidebar: pakai
 * sphere_getFiatBalance kalau wallet nyediain, kalau nggak jumlahin
 * fiatValueUsd per-asset dari wallet apa adanya.
 *
 * CATATAN: token custom yang nggak di-price sendiri sama wallet (UCT/USDU)
 * bakal kehitung $0 di sini walau amount-nya beneran ada -- itu karena
 * komponen ini sengaja nggak manggil useAssetPrices/CoinGecko sendiri (biar
 * nggak double-fetch bareng mobile header dan malah balik kena rate limit
 * 429). Daftar token di dropdown "View assets" di bawah juga cuma nampilin
 * valueUsd apa adanya dari wallet, tanpa fetch harga tambahan.
 */
function computeTotalUsd(totalFiat: number | null, assets: WalletAsset[]): number | null {
  if (totalFiat !== null) return totalFiat
  if (assets.length === 0) return null
  const known = assets.filter((a) => a.valueUsd)
  if (known.length === 0) return null
  return known.reduce((sum, a) => sum + (a.valueUsd ?? 0), 0)
}

export function ConnectWallet() {
  const {
    walletAddress,
    connecting,
    isAutoConnecting,
    isWalletLocked,
    connectionMode,
    error,
    connect,
    disconnect,
    assets,
    totalFiat,
    balanceLoading,
    refreshBalance,
  } = useWallet()
  const { profile } = useProfile()
  const { tier: verificationTier } = useVerification()
  const [menuOpen, setMenuOpen] = useState(false)
  // Daftar token di-expand langsung di dalam dropdown ini (nggak pindah ke
  // halaman lain) -- biar tetep ringkas, cukup dikasih max-height + scroll.
  const [assetsOpen, setAssetsOpen] = useState(false)

  const totalUsd = computeTotalUsd(totalFiat, assets)

  function closeMenu() {
    setMenuOpen(false)
    setAssetsOpen(false)
  }

  if (isAutoConnecting) {
    return (
      <div className="flex w-full animate-pulse items-center justify-center rounded-full border border-surface-border bg-surface px-5 py-2.5 text-sm font-medium text-ink-muted lg:w-full">
        Checking wallet…
      </div>
    )
  }

  if (!walletAddress) {
    return (
      <div className="w-full">
        <button
          className="w-full rounded-full bg-brand-gradient px-5 py-2.5 text-[15px] font-semibold text-accent-contrast shadow-glow transition-transform duration-150 hover:scale-[1.02] hover:shadow-glowCyan active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          onClick={connect}
          disabled={connecting}
        >
          {connecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <button
        className="flex w-full items-center gap-2.5 rounded-full border border-transparent px-2 py-1.5 text-left transition-colors hover:border-surface-border hover:bg-surface lg:gap-3 lg:px-3 lg:py-2"
        onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
          style={{ background: avatarColor(walletAddress) }}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            avatarInitial(walletAddress)
          )}
        </div>
        <div className="hidden min-w-0 flex-1 flex-col items-start lg:flex">
          <span className="flex min-w-0 items-center gap-1 font-mono text-[13px] font-medium text-ink">
            <span className="truncate">{shortenAddress(walletAddress)}</span>
            <VerifiedBadge tier={verificationTier} size={13} />
          </span>
          {isWalletLocked ? (
            <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-medium text-danger">
              wallet locked
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-ink-faint" title={connectionMode ? MODE_LABEL[connectionMode] : undefined}>
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
              {totalUsd !== null ? formatUsd(totalUsd) : balanceLoading ? 'Loading balance…' : '—'}
            </span>
          )}
        </div>
        <span className="hidden text-ink-muted lg:block">
          <ChevronDownIcon size={16} />
        </span>
      </button>

      {menuOpen && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-64 animate-scale-in rounded-2xl border border-surface-border bg-surface-soft p-1.5 shadow-card">
          <div className="flex items-center justify-between px-3 pb-1.5 pt-1">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
              Total balance
            </span>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50"
              onClick={() => refreshBalance()}
              disabled={balanceLoading}
              aria-label="Refresh balance"
              title="Refresh balance"
            >
              <RefreshIcon size={13} />
            </button>
          </div>

          <div className="px-3 pb-2">
            <span className="font-mono text-[20px] font-bold text-ink">
              {totalUsd !== null ? formatUsd(totalUsd) : balanceLoading ? 'Loading…' : '—'}
            </span>
          </div>

          <button
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-ink transition-colors hover:bg-surface-hover"
            onClick={() => setAssetsOpen((v) => !v)}
            aria-expanded={assetsOpen}
          >
            <span className="flex items-center gap-1.5">
              View assets
              <span
                className="text-ink-faint transition-transform duration-150"
                style={{ transform: assetsOpen ? 'rotate(180deg)' : 'none' }}
              >
                <ChevronDownIcon size={12} />
              </span>
            </span>
            <span className="text-ink-faint">{assets.length > 0 ? `${assets.length} tokens` : ''}</span>
          </button>

          {assetsOpen && (
            <div className="mb-1.5 max-h-40 overflow-y-auto rounded-xl bg-surface px-1 py-1">
              {assets.length === 0 ? (
                <div className="px-2 py-2 text-[12.5px] text-ink-faint">
                  {balanceLoading ? 'Loading tokens…' : 'No tokens yet'}
                </div>
              ) : (
                assets.map((asset) => (
                  <div
                    key={asset.coinId ?? asset.symbol}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[10px] font-semibold text-ink-faint">
                      {asset.symbol.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[12.5px] font-medium text-ink">${asset.symbol}</div>
                      <div className="truncate text-[11px] text-ink-faint">
                        {formatAmount(asset.amountBase, asset.decimals)}
                      </div>
                    </div>
                    {asset.valueUsd ? (
                      <div className="shrink-0 font-mono text-[12px] text-ink-muted">{formatUsd(asset.valueUsd)}</div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          )}

          <div className="mx-1 mb-1.5 border-t border-surface-border" />

          <button
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-ink transition-colors hover:bg-surface-hover"
            onClick={() => {
              disconnect()
              closeMenu()
            }}
          >
            <LogoutIcon size={16} />
            Disconnect wallet
          </button>
        </div>
      )}
    </div>
  )
}
