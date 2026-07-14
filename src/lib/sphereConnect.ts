
export type SphereConnectionMode = 'iframe' | 'extension' | 'popup'

export const WALLET_URL =
  (import.meta.env.VITE_SPHERE_WALLET_URL as string | undefined) || 'https://sphere.unicity.network'

export const POPUP_WINDOW_NAME = 'sphere-connect-popup'

export function getDappDescriptor() {
  return {
    name: 'Musyawarah',
    description: 'Medsos ala Warpcast — posting & kasih tip pakai UCT',
    url: typeof window !== 'undefined' ? window.location.origin : '',
  }
}

export function isInIframe(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

export function hasExtension(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as unknown as { sphere?: unknown }).sphere)
}

export interface SphereIdentity {
  nametag?: string | null
  chainPubkey?: string | null
  address?: string | null
  [key: string]: unknown
}

export function identityToHandle(identity: SphereIdentity | null | undefined): string {
  if (!identity) return ''
  if (identity.nametag) return `@${identity.nametag}`
  return identity.chainPubkey ?? identity.address ?? ''
}

export function formatRecipient(handle: string): string {
  if (!handle) return handle
  if (handle.startsWith('@') || handle.startsWith('DIRECT://')) return handle
  return `DIRECT://${handle}`
}

export function toBaseUnits(amount: number | string, decimals: number): string {
  const [wholeRaw, fracRaw = ''] = String(amount).trim().split('.')
  const whole = wholeRaw.replace(/[^0-9]/g, '') || '0'
  const frac = fracRaw.replace(/[^0-9]/g, '').slice(0, decimals).padEnd(decimals, '0')
  const combined = `${whole}${frac}`.replace(/^0+(?=\d)/, '')
  return BigInt(combined || '0').toString()
}

export const DEFAULT_UCT_DECIMALS = 6

export function isValidHexCoinId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]+$/.test(value) && value.length % 2 === 0
}

export function fromBaseUnits(amountBase: string | number, decimals: number): string {
  const raw = String(amountBase).replace(/[^0-9]/g, '') || '0'
  if (decimals <= 0) return raw.replace(/^0+(?=\d)/, '')
  const padded = raw.padStart(decimals + 1, '0')
  const whole = padded.slice(0, padded.length - decimals).replace(/^0+(?=\d)/, '')
  const frac = padded.slice(-decimals).replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole
}

export interface WalletAsset {
  coinId?: string
  symbol: string
  name?: string
  amountBase: string
  decimals: number
  valueUsd: number | null
}

export function parseWalletAssets(raw: unknown): WalletAsset[] {
  const list = Array.isArray(raw) ? raw : (raw as { assets?: unknown } | null | undefined)?.assets
  if (!Array.isArray(list)) return []

  return list.map((item): WalletAsset => {
    const obj = (item ?? {}) as Record<string, unknown>
    const symbol = String(obj.symbol ?? obj.ticker ?? obj.name ?? obj.coinId ?? '???').toUpperCase()
    const decimals = typeof obj.decimals === 'number' ? obj.decimals : DEFAULT_UCT_DECIMALS
    const amountBase = String(
      obj.totalAmount ?? obj.confirmedAmount ?? obj.amount ?? obj.balance ?? obj.amountBase ?? '0'
    )
    const valueUsdRaw = obj.fiatValueUsd ?? obj.valueUsd ?? obj.fiatValue ?? obj.usdValue
    return {
      coinId: typeof obj.coinId === 'string' ? obj.coinId : undefined,
      symbol,
      name: typeof obj.name === 'string' ? obj.name : undefined,
      amountBase,
      decimals,
      valueUsd: typeof valueUsdRaw === 'number' ? valueUsdRaw : null,
    }
  })
}

export function parseFiatTotal(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  const obj = raw as Record<string, unknown> | null | undefined
  const val = obj?.total ?? obj?.amount ?? obj?.value ?? obj?.usd
  return typeof val === 'number' ? val : null
}

export function computeHoldingsTotalUsd(
  holdings: WalletAsset[],
  priceBySymbol: Map<string, number>
): number {
  return holdings.reduce((sum, h) => {
    if (h.valueUsd) return sum + h.valueUsd
    const price = priceBySymbol.get(h.symbol.toUpperCase())
    if (!price) return sum
    const amount = Number(fromBaseUnits(h.amountBase, h.decimals))
    return sum + (Number.isFinite(amount) ? amount * price : 0)
  }, 0)
}
