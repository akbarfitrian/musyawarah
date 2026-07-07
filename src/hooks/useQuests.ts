import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import type { QuestBoardRow } from '../types'

/**
 * Papan quest & achievement, diambil lewat satu RPC call (get_quest_board,
 * lihat supabase/003_quests.sql). Progres quest sendiri ditegakkan &
 * dicatat di server -- hook ini cuma BACA state-nya, tidak pernah
 * menandai quest selesai dari client.
 */
export function useQuests() {
  const { walletAddress } = useWallet()
  const [quests, setQuests] = useState<QuestBoardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase.rpc('get_quest_board', {
        p_wallet: walletAddress ?? '',
      })
      if (fetchError) throw fetchError
      setQuests((data ?? []) as QuestBoardRow[])
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal ngambil papan quest:', e)
      setError('Failed to load quests.')
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    refresh()
  }, [refresh])

  const completedCount = quests.filter((q) => q.completed).length
  const totalPoints = quests.reduce((sum, q) => sum + (q.completed ? q.points : 0), 0)
  const maxPoints = quests.reduce((sum, q) => sum + q.points, 0)

  return { quests, loading, error, refresh, completedCount, totalPoints, maxPoints }
}
