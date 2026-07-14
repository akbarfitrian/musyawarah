import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssetPrice } from '../types'

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  ETH: 'ethereum',
  SOL: 'solana',
}

const CUSTOM_ASSETS: Record<string, string> = {
  UCT: 'Unicity',
  USDU: 'Unicity USD',
}

const ASSET_ORDER = ['UCT', 'BTC', 'ETH', 'SOL', 'USDC', 'USDT', 'USDU']

function buildInitialAssets(): AssetPrice[] {
  return ASSET_ORDER.map((symbol) => {
    if (symbol in CUSTOM_ASSETS) {
      return {
        coingeckoId: null,
        symbol,
        name: CUSTOM_ASSETS[symbol],
        price: 1,
        change24h: null,
        logoUrl: null,
        isCustom: true,
      }
    }
    return {
      coingeckoId: COINGECKO_IDS[symbol],
      symbol,
      name: symbol,
      price: 0,
      change24h: null,
      logoUrl: null,
      isCustom: false,
    }
  })
}

interface CoinGeckoMarket {
  id: string
  name: string
  image: string
  current_price: number
  price_change_percentage_24h: number | null
}

export function useAssetPrices() {
  const [assets, setAssets] = useState<AssetPrice[]>(buildInitialAssets)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const inFlightRef = useRef(false)
  const backoffUntilRef = useRef(0)

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return
    if (Date.now() < backoffUntilRef.current) return
    inFlightRef.current = true
    setLoading(true)
    setError(null)
    try {
      const ids = Object.values(COINGECKO_IDS).join(',')
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`
      )
      if (res.status === 429) {
        backoffUntilRef.current = Date.now() + 120000
        throw new Error('CoinGecko rate limit (429)')
      }
      if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`)

      const data = (await res.json()) as CoinGeckoMarket[]
      const byId = new Map(data.map((d) => [d.id, d]))

      setAssets((prev) =>
        prev.map((a) => {
          if (a.isCustom || !a.coingeckoId) return a
          const found = byId.get(a.coingeckoId)
          if (!found) return a
          return {
            ...a,
            name: found.name,
            price: found.current_price,
            change24h: found.price_change_percentage_24h,
            logoUrl: found.image,
          }
        })
      )
    } catch (e) {
      const isRateLimit = e instanceof Error && e.message.includes('429')
      setError(
        isRateLimit
          ? 'CoinGecko is rate-limiting us right now. Showing last known values, retrying shortly.'
          : 'Failed to load live prices from CoinGecko. Showing last known values.'
      )
      console.error('[MUSYAWARAH] Gagal ngambil harga dari CoinGecko:', e)
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const interval = setInterval(refresh, 60000)
    return () => clearInterval(interval)
  }, [refresh])

  return { assets, loading, error, refresh }
}
