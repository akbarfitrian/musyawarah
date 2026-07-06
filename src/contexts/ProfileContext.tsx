import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from './WalletContext'
import type { Profile } from '../types'

// ============================================================================
// PROFILE STATE — satu sumber data dipakai bareng-bareng
// ----------------------------------------------------------------------------
// Sebelumnya tiap komponen (ProfilePage, ConnectWallet, dll) manggil hook
// `useProfile` sendiri-sendiri, jadi masing-masing punya salinan state
// terpisah. Akibatnya avatar/bio yang baru diupdate di satu tempat nggak
// langsung nongol di tempat lain (mis. ikon connect wallet) sampai halaman
// di-reload. Context ini bikin satu instance state yang dipakai bersama.
// ============================================================================

interface ProfileContextValue {
  profile: Profile | null
  loading: boolean
  refresh: () => Promise<void>
  updateProfile: (fields: Partial<Pick<Profile, 'bio' | 'avatar_url' | 'username'>>) => Promise<Profile>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { walletAddress } = useWallet()
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

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile harus dipakai di dalam <ProfileProvider>')
  return ctx
}
