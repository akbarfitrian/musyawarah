import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { TopTippedPeriod, TopTippedRow } from '../types'

/**
 * Papan top-tipped, satu RPC call (get_top_tipped, lihat
 * supabase/004_top_tipped.sql). Server yang mengagregasi total tip
 * diterima per wallet -- 'weekly' dihitung sejak Senin 00:00 UTC minggu
 * berjalan, 'all_time' dari awal.
 */
export function useTopTipped(period: TopTippedPeriod, limit = 5) {
  const [rows, setRows] = useState<TopTippedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase.rpc('get_top_tipped', {
        p_period: period,
        p_limit: limit,
      })
      if (fetchError) throw fetchError
      setRows((data ?? []) as TopTippedRow[])
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal ngambil papan top tipped:', e)
      setError('Failed to load leaderboard.')
    } finally {
      setLoading(false)
    }
  }, [period, limit])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { rows, loading, error, refresh }
}
