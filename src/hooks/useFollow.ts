import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'

export function useFollow(targetWallet: string | null) {
  const { walletAddress: myWallet } = useWallet()
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!targetWallet) {
      setIsFollowing(false)
      setFollowerCount(0)
      setFollowingCount(0)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [followerRes, followingRes, meRes] = await Promise.all([
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('followed_wallet', targetWallet),
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_wallet', targetWallet),
        myWallet
          ? supabase
              .from('follows')
              .select('id')
              .eq('follower_wallet', myWallet)
              .eq('followed_wallet', targetWallet)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (followerRes.error) throw followerRes.error
      if (followingRes.error) throw followingRes.error
      if (meRes.error) throw meRes.error

      setFollowerCount(followerRes.count ?? 0)
      setFollowingCount(followingRes.count ?? 0)
      setIsFollowing(!!meRes.data)
    } catch (e) {
      setError('Failed to load follow status.')
      console.error('[MUSYAWARAH] Gagal ngambil status follow:', e)
    } finally {
      setLoading(false)
    }
  }, [targetWallet, myWallet])

  useEffect(() => {
    refresh()
  }, [refresh])

  const toggleFollow = useCallback(async () => {
    if (!myWallet || !targetWallet || myWallet === targetWallet || busy) return
    setBusy(true)
    setError(null)

    const wasFollowing = isFollowing
    setIsFollowing(!wasFollowing)
    setFollowerCount((c) => (wasFollowing ? Math.max(0, c - 1) : c + 1))

    try {
      const { error: toggleError } = await supabase.rpc('toggle_follow', {
        p_follower: myWallet,
        p_followed: targetWallet,
      })

      if (toggleError) throw toggleError
    } catch (e) {
      setIsFollowing(wasFollowing)
      setFollowerCount((c) => (wasFollowing ? c + 1 : Math.max(0, c - 1)))
      setError('Failed to update follow status. Try again.')
      console.error('[MUSYAWARAH] Gagal toggle follow:', e)
    } finally {
      setBusy(false)
    }
  }, [myWallet, targetWallet, isFollowing, busy])

  return { isFollowing, followerCount, followingCount, loading, busy, error, toggleFollow, refresh }
}
