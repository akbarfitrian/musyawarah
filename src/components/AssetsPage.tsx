import { useEffect } from 'react'
import { useAssetPrices } from '../hooks/useAssetPrices'
import { useWallet } from '../contexts/WalletContext'
import { computeHoldingsTotalUsd, fromBaseUnits, type WalletAsset } from '../lib/sphereConnect'
import type { AssetPrice } from '../types'
import { RefreshIcon } from './icons'

function formatAmount(amountBase: string, decimals: number): string {
  const value = Number(fromBaseUnits(amountBase, decimals))
  if (Number.isNaN(value)) return fromBaseUnits(amountBase, decimals)
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function findHolding(assets: WalletAsset[], symbol: string): WalletAsset | undefined {
  return assets.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase())
}

function formatPrice(price: number): string {
  if (!price) return '—'
  const decimals = price >= 1 ? 2 : 4
  return price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatChange(change: number | null): string | null {
  if (change === null || Number.isNaN(change)) return null
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}%`
}

function AssetLogo({ asset }: { asset: AssetPrice }) {
  if (asset.isCustom) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-[16px] font-bold text-yellow-400">
        $
      </div>
    )
  }

  if (asset.logoUrl) {
    return (
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface-hover">
        <img src={asset.logoUrl} alt="" className="h-full w-full object-cover" />
      </div>
    )
  }

  return (
    <div className="flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-full bg-surface-hover text-[13px] font-semibold text-ink-faint">
      {asset.symbol.slice(0, 1)}
    </div>
  )
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function AssetRow({ asset, holding }: { asset: AssetPrice; holding?: WalletAsset }) {
  const changeLabel = formatChange(asset.change24h)
  const isUp = (asset.change24h ?? 0) >= 0

  const heldAmount = holding ? Number(fromBaseUnits(holding.amountBase, holding.decimals)) : null
  const computedValue = heldAmount !== null && asset.price ? heldAmount * asset.price : null
  const heldValue = holding?.valueUsd ? holding.valueUsd : computedValue
  const hasHeldValue = Boolean(holding) && heldValue !== null

  return (
    <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3.5 last:border-b-0">
      <AssetLogo asset={asset} />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[14px] font-semibold text-ink">${asset.symbol}</div>
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12.5px] text-ink-muted">{asset.name}</span>
          {asset.isCustom ? (
            <span className="shrink-0 text-[11px] font-medium text-ink-faint">Pegged</span>
          ) : (
            changeLabel && (
              <span className={`shrink-0 text-[11px] font-medium ${isUp ? 'text-emerald-600' : 'text-danger'}`}>
                {changeLabel}
              </span>
            )
          )}
        </div>
        {holding && (
          <div className="mt-0.5 truncate text-[12.5px] text-ink-faint">
            {formatAmount(holding.amountBase, holding.decimals)} ${asset.symbol}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[14px] font-semibold text-ink">
          {hasHeldValue ? formatUsd(heldValue as number) : formatPrice(asset.price)}
        </div>
        {hasHeldValue && <div className="text-[12px] text-ink-faint">{formatPrice(asset.price)} / {asset.symbol}</div>}
      </div>
    </div>
  )
}

export function AssetsPage() {
  const { assets, loading, error, refresh } = useAssetPrices()
  const { walletAddress, assets: holdings, balanceLoading, refreshBalance } = useWallet()

  useEffect(() => {
    if (!walletAddress) return
    refreshBalance()
    const interval = setInterval(refreshBalance, 30000)
    return () => clearInterval(interval)
  }, [walletAddress, refreshBalance])

  const priceBySymbol = new Map(assets.map((a) => [a.symbol.toUpperCase(), a.price]))
  const totalHeldUsd = computeHoldingsTotalUsd(holdings, priceBySymbol)

  return (
    <div>
      <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="m-0 font-display text-[22px] font-bold text-ink">Assets</h1>
            <span
              className="flex items-center gap-1 rounded-full bg-surface-hover px-2 py-1 text-[11px] font-medium text-ink-faint"
              title="Live prices from CoinGecko. $UCT and $USDU are Unicity network tokens pegged at a fixed $1."
            >
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
              Live
            </span>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50"
            onClick={() => {
              refresh()
              if (walletAddress) refreshBalance()
            }}
            disabled={loading || balanceLoading}
            aria-label="Refresh prices"
            title="Refresh prices"
          >
            <RefreshIcon size={17} />
          </button>
        </div>

        {walletAddress && (
          <div className="mt-4 rounded-xl bg-surface-hover px-4 py-3">
            <div className="text-[12px] font-medium text-ink-muted">Your balance</div>
            <div className="font-mono text-[20px] font-bold text-ink">
              {balanceLoading && holdings.length === 0 ? 'Loading…' : formatUsd(totalHeldUsd)}
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-card">
        {assets.map((asset) => (
          <AssetRow key={asset.symbol} asset={asset} holding={findHolding(holdings, asset.symbol)} />
        ))}
      </div>
    </div>
  )
}
