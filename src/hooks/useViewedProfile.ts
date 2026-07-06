import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { VerificationTier } from '../lib/verification'
import type { Profile } from '../types'

/**
 * Ambil profil wallet siapa aja (read-only), buat fitur "visit profil orang
 * lain". Beda sama `useProfile` di ProfileContext yang khusus buat profil
 * wallet yang lagi connect di app ini sendiri (dan bisa di-update).
 *
 * Sekalian ambil tier verifikasi wallet itu (buat badge centang/berlian di
 * samping username-nya).
 */
export function useViewedProfile(walletAddress: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [verificationTier, setVerificationTier] = useState<VerificationTier>('none')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      setProfile(null)
      setVerificationTier('none')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [profileRes, verificationRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('wallet_address', walletAddress).maybeSingle(),
        supabase.from('verifications').select('tier, expires_at').eq('wallet_address', walletAddress).maybeSingle(),
      ])

      if (profileRes.error) throw profileRes.error
      setProfile(profileRes.data)

      if (verificationRes.error) {
        console.warn('[MUSYAWARAH] Gagal ngambil status verifikasi profil:', verificationRes.error)
        setVerificationTier('none')
      } else {
        const expiresAt = verificationRes.data?.expires_at as string | null | undefined
        const isExpired = Boolean(expiresAt) && new Date(expiresAt as string).getTime() <= Date.now()
        setVerificationTier(isExpired ? 'none' : ((verificationRes.data?.tier as VerificationTier | undefined) ?? 'none'))
      }
    } catch (e) {
      setError('Failed to load profile.')
      console.error('[MUSYAWARAH] Gagal ngambil profil yang dikunjungi:', e)
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { profile, verificationTier, loading, error, refresh }
}
