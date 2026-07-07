import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { TopTippedPeriod, TopTippedPostRow } from '../types'

/**
 * Papan "Trending" -- top post berdasar total tip diterima, satu RPC call
 * (get_top_tipped_posts, lihat supabase/005_top_tipped_posts.sql). Sama
 * pattern-nya dengan useTopTipped.ts (leaderboard user), bedanya
 * agregasinya per post_id. Default limit 3 (top 3 post).
 */
export function useTopTippedPosts(period: TopTippedPeriod, limit = 3) {
  const [rows, setRows] = useState<TopTippedPostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase.rpc('get_top_tipped_posts', {
        p_period: period,
        p_limit: limit,
      })
      if (fetchError) throw fetchError
      setRows((data ?? []) as TopTippedPostRow[])
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal ngambil papan trending:', e)
      setError('Failed to load trending posts.')
    } finally {
      setLoading(false)
    }
  }, [period, limit])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { rows, loading, error, refresh }
}
