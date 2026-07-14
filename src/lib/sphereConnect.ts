// ============================================================================
// SPHERE CONNECT — helper murni (deteksi transport, format identity/amount)
// ----------------------------------------------------------------------------
// Referensi:
//   - https://github.com/unicity-sphere/sphere            (wallet, ConnectHost)
//   - https://github.com/unicity-sphere/sphere-sdk-connect-example
//     -> browser/CONNECT.md (panduan integrasi dApp lengkap)
//     -> sphere-sdk/docs/CONNECT.md (protocol reference)
// ============================================================================

export type SphereConnectionMode = 'iframe' | 'extension' | 'popup'

/** URL wallet Sphere buat mode popup (P3). Override lewat VITE_SPHERE_WALLET_URL. */
export const WALLET_URL =
  (import.meta.env.VITE_SPHERE_WALLET_URL as string | undefined) || 'https://sphere.unicity.network'

/** Nama window popup — dipakai konsisten biar window.open() re-focus popup yang sama, bukan buka baru. */
export const POPUP_WINDOW_NAME = 'sphere-connect-popup'

/** Identitas dApp ini, dikirim ke wallet pas request connect. */
export function getDappDescriptor() {
  return {
    name: 'Musyawarah',
    description: 'Medsos ala Warpcast — posting & kasih tip pakai UCT',
    url: typeof window !== 'undefined' ? window.location.origin : '',
  }
}

/**
 * P1 — dApp ini lagi jalan di dalam iframe Sphere (mis. dimuat sebagai
 * "Sphere Agent" lewat /agents/custom?url=...). Cross-origin iframe nggak
 * bisa akses window.top, jadi try/catch dipakai buat deteksi aman.
 */
export function isInIframe(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * P2 — Sphere browser extension ke-install. Extension nyuntik `window.sphere`
 * (dipakai ExtensionTransport di belakang layar).
 */
export function hasExtension(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as unknown as { sphere?: unknown }).sphere)
}

/** Bentuk minimal identity yang dibalikin wallet — field lain diabaikan. */
export interface SphereIdentity {
  nametag?: string | null
  chainPubkey?: string | null
  address?: string | null
  [key: string]: unknown
}

/** Ubah identity jadi satu string handle buat disimpan/ditampilkan di app ini. */
export function identityToHandle(identity: SphereIdentity | null | undefined): string {
  if (!identity) return ''
  if (identity.nametag) return `@${identity.nametag}`
  return identity.chainPubkey ?? identity.address ?? ''
}

/**
 * Siapin field `to` buat intent `send`/`payment_request`. Nametag (@alice)
 * dikirim apa adanya; alamat mentah dibungkus DIRECT:// sesuai protocol
 * reference (`to: '@alice' — nametag atau DIRECT:// address`).
 */
export function formatRecipient(handle: string): string {
  if (!handle) return handle
  if (handle.startsWith('@') || handle.startsWith('DIRECT://')) return handle
  return `DIRECT://${handle}`
}

/**
 * Konversi amount desimal (mis. "1.5") ke base units (string integer) tanpa
 * lewat floating point, biar nggak ada rounding error kayak 0.1 + 0.2.
 */
export function toBaseUnits(amount: number | string, decimals: number): string {
  const [wholeRaw, fracRaw = ''] = String(amount).trim().split('.')
  const whole = wholeRaw.replace(/[^0-9]/g, '') || '0'
  const frac = fracRaw.replace(/[^0-9]/g, '').slice(0, decimals).padEnd(decimals, '0')
  const combined = `${whole}${frac}`.replace(/^0+(?=\d)/, '')
  return BigInt(combined || '0').toString()
}

/** Fallback kalau resolusi coinId UCT dari wallet gagal — lihat resolveUctCoin di WalletContext. */
export const DEFAULT_UCT_DECIMALS = 6

/**
 * Protocol reference Sphere Connect minta coinId dalam bentuk hex lowercase
 * genap panjangnya (byte-aligned). Dipakai buat validasi SEBELUM coinId
 * dikirim ke wallet lewat intent `send` -- daripada nembak nilai yang jelas2
 * bakal ditolak wallet (mis. literal "UCT") dan nunggu error mentah balik
 * dari sisi wallet ("coinId must be lowercase even-length hex").
 */
export function isValidHexCoinId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]+$/.test(value) && value.length % 2 === 0
}

/**
 * Kebalikan dari toBaseUnits() — buat nampilin amount mentah (base units,
 * integer string dari wallet) jadi angka desimal yang enak dibaca. Dikerjain
 * pakai string manipulation (bukan Number() / division) biar konsisten sama
 * toBaseUnits dan nggak kena floating point rounding buat token gede.
 */
export function fromBaseUnits(amountBase: string | number, decimals: number): string {
  const raw = String(amountBase).replace(/[^0-9]/g, '') || '0'
  if (decimals <= 0) return raw.replace(/^0+(?=\d)/, '')
  const padded = raw.padStart(decimals + 1, '0')
  const whole = padded.slice(0, padded.length - decimals).replace(/^0+(?=\d)/, '')
  const frac = padded.slice(-decimals).replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole
}

/** Satu jenis token yang dipegang wallet — hasil parse sphere_getAssets. */
export interface WalletAsset {
  coinId?: string
  symbol: string
  name?: string
  /** Amount mentah (base units, integer string) langsung dari wallet. */
  amountBase: string
  decimals: number
  /** Nilai dalam USD kalau wallet nyediain, null kalau nggak ada. */
  valueUsd: number | null
}

/**
 * Parse hasil query sphere_getAssets jadi daftar WalletAsset.
 *
 * Bentuk asli respons (dikonfirmasi dari live wallet, 2026-07-05):
 *   { coinId, symbol, name, decimals, totalAmount, confirmedAmount,
 *     unconfirmedAmount, priceUsd, fiatValueUsd, change24h, ... }
 * Amount dipakai dari totalAmount (fallback ke confirmedAmount kalau nggak
 * ada) -- BUKAN `amount`/`balance` kayak dugaan awal, makanya sebelumnya
 * selalu kebaca 0. Sama buat value USD: field-nya fiatValueUsd, bukan
 * valueUsd/fiatValue/usdValue.
 */
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

/**
 * Parse hasil query sphere_getFiatBalance (total portofolio dalam USD).
 * Query ini sengaja dianggap opsional di WalletContext (di-.catch(() =>
 * null)) — kalau wallet nggak nyediain, kita tampilin total dari
 * penjumlahan valueUsd per-asset aja.
 */
export function parseFiatTotal(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  const obj = raw as Record<string, unknown> | null | undefined
  const val = obj?.total ?? obj?.amount ?? obj?.value ?? obj?.usd
  return typeof val === 'number' ? val : null
}

/**
 * Total portofolio dari daftar holding, dikasih tau harga per simbol
 * (mis. dari useAssetPrices atau daftar sejenis). Prioritas per-asset:
 * fiatValueUsd dari wallet kalau > 0, kalau nggak (mis. token custom
 * UCT/USDU yang nggak di-price sendiri sama wallet) hitung manual dari
 * amount * harga. Dipakai bareng-bareng di ConnectWallet & AssetsPage biar
 * angkanya konsisten di semua tempat.
 */
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
