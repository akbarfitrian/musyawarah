export type SphereConnectionMode = 'iframe' | 'extension' | 'popup'

export const WALLET_URL =
  (import.meta.env.VITE_SPHERE_WALLET_URL as string | undefined) || 'https://sphere.unicity.network'

export const POPUP_WINDOW_NAME = 'sphere-connect-popup'

export const POPUP_WINDOW_FEATURES = 'width=420,height=720,scrollbars=yes,resizable=yes'

// Must match the wallet-side broadcast in the Sphere Connect protocol
// (`sphere-connect:host-ready`) — the popup posts this once its ConnectHost
// transport is actually listening, so we know it's safe to send the
// handshake instead of racing a postMessage into a page that hasn't
// finished loading yet.
const HOST_READY_TYPE = 'sphere-connect:host-ready'
const HOST_READY_TIMEOUT_MS = 30000
const POPUP_CLOSE_POLL_MS = 500

export function getDappDescriptor() {
  return {
    name: 'Musyawarah',
    description: 'Social Web3 & Skill AI Agent Marketplace with Escrow Trusted',
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

/**
 * URL for the wallet's standalone connect popup — the ACTUAL browser
 * popup window (window.open), not the Sphere browser extension.
 */
export function buildPopupConnectUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${WALLET_URL}/connect?origin=${encodeURIComponent(origin)}`
}

/**
 * Opens the Sphere wallet connect popup. Returns null if the browser
 * blocked it (pop-up blocker) so the caller can show a clear message
 * instead of silently hanging.
 */
export function openWalletPopup(): Window | null {
  if (typeof window === 'undefined') return null
  return window.open(buildPopupConnectUrl(), POPUP_WINDOW_NAME, POPUP_WINDOW_FEATURES)
}

/**
 * Waits for the popup's ConnectHost to signal it's ready to receive the
 * handshake. Rejects early if the popup is closed before that happens,
 * instead of leaving the caller hanging until the connect timeout.
 */
export function waitForPopupReady(popup: Window): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Wallet popup did not respond. Try Connect Wallet again.'))
    }, HOST_READY_TIMEOUT_MS)

    const closeCheck = setInterval(() => {
      if (popup.closed) {
        cleanup()
        reject(new Error('Wallet popup was closed before it was ready to connect.'))
      }
    }, POPUP_CLOSE_POLL_MS)

    function listener(event: MessageEvent) {
      const data = event.data as { type?: unknown } | null
      if (data && data.type === HOST_READY_TYPE) {
        cleanup()
        resolve()
      }
    }

    function cleanup() {
      clearTimeout(timer)
      clearInterval(closeCheck)
      window.removeEventListener('message', listener)
    }

    window.addEventListener('message', listener)
  })
}

export interface SphereIdentity {
  nametag?: string | null
  chainPubkey?: string | null
  address?: string | null
  [key: string]: unknown
}

/**
 * Resolves the identity's canonical `wallet_address` — used everywhere as
 * the DB primary key (`profiles.wallet_address`) AND as the value that must
 * cryptographically verify against the wallet's signature in the
 * wallet-login flow. This MUST always be the raw chainPubkey/address, never
 * the display nametag — a signature can't be verified against a text handle
 * like "@yandi1", only against the actual secp256k1 pubkey. The "@handle"
 * shown in the UI is derived from this same wallet_address elsewhere, not
 * stored/used as a separate identifier.
 */
export function identityToHandle(identity: SphereIdentity | null | undefined): string {
  if (!identity) return ''
  return identity.chainPubkey ?? identity.address ?? (identity.nametag ? `@${identity.nametag}` : '')
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