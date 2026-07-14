import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'
import type { VerificationTier } from '../lib/verification'

export interface UserSearchResult extends Profile {
  verification_tier?: VerificationTier
}

const DEBOUNCE_MS = 250

export function useUserSearch(query: string) {
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const thisRequest = ++requestId.current

    const timer = setTimeout(async () => {
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.%${trimmed}%,wallet_address.ilike.%${trimmed}%`)
          .limit(8)

        if (error) throw error
        if (thisRequest !== requestId.current) return

        const wallets = (profiles ?? []).map((p) => p.wallet_address)
        let tierByWallet: Record<string, VerificationTier> = {}

        if (wallets.length > 0) {
          const { data: verifications } = await supabase
            .from('verifications')
            .select('wallet_address, tier, expires_at')
            .in('wallet_address', wallets)

          const now = Date.now()
          tierByWallet = (verifications ?? []).reduce(
            (acc, v) => {
              const stillActive = !v.expires_at || new Date(v.expires_at).getTime() > now
              if (stillActive) acc[v.wallet_address] = v.tier as VerificationTier
              return acc
            },
            {} as Record<string, VerificationTier>
          )
        }

        setResults(
          (profiles ?? []).map((p) => ({ ...p, verification_tier: tierByWallet[p.wallet_address] }))
        )
      } catch (e) {
        console.error('[MUSYAWARAH] Gagal nyari user:', e)
        if (thisRequest === requestId.current) setResults([])
      } finally {
        if (thisRequest === requestId.current) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query])

  return { results, loading }
}
