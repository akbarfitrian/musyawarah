import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { dailyPostLimit, startOfUtcDayIso, type VerificationTier } from '../lib/verification'

export function usePostQuota(walletAddress: string | null, tier: VerificationTier) {
  const [usedToday, setUsedToday] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      setUsedToday(0)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { count, error } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('author_wallet', walletAddress)
        .gte('created_at', startOfUtcDayIso())

      if (error) throw error
      setUsedToday(count ?? 0)
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal ngitung kuota posting harian:', e)
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    refresh()
  }, [refresh])

  const limit = dailyPostLimit(tier)
  const remaining = limit === null ? null : Math.max(0, limit - usedToday)
  const reachedLimit = limit !== null && usedToday >= limit

  return { usedToday, limit, remaining, reachedLimit, loading, refresh }
}
