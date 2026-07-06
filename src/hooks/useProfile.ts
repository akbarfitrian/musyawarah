import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'

export function useProfile(walletAddress: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', walletAddress)
        .maybeSingle()

      if (error) throw error
      setProfile(data)
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal ngambil profil:', e)
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    refresh()
  }, [refresh])

  /** Upsert sebagian field profil (bio dan/atau avatar_url). */
  const updateProfile = useCallback(
    async (fields: Partial<Pick<Profile, 'bio' | 'avatar_url' | 'username'>>) => {
      if (!walletAddress) throw new Error('Wallet belum connect')
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ wallet_address: walletAddress, ...fields })
        .select('*')
        .single()

      if (error) throw error
      setProfile(data)
      return data as Profile
    },
    [walletAddress]
  )

  return { profile, loading, refresh, updateProfile }
}
