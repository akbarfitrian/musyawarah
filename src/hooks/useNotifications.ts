import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import type { AppNotification } from '../types'
import type { VerificationTier } from '../lib/verification'

export function useNotifications() {
  const { walletAddress } = useWallet()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      setNotifications([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: queryError } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_wallet', walletAddress)
        .order('created_at', { ascending: false })
        .limit(200)

      if (queryError) throw queryError
      const rows = (data ?? []) as AppNotification[]

      const actorWallets = [...new Set(rows.map((n) => n.actor_wallet))]
      const postIds = [...new Set(rows.filter((n) => n.post_id).map((n) => n.post_id as string))]

      const [profilesRes, verificationsRes, postsRes] = await Promise.all([
        actorWallets.length > 0
          ? supabase.from('profiles').select('wallet_address, avatar_url').in('wallet_address', actorWallets)
          : Promise.resolve({ data: [] as { wallet_address: string; avatar_url: string | null }[], error: null }),
        actorWallets.length > 0
          ? supabase.from('verifications').select('wallet_address, tier, expires_at').in('wallet_address', actorWallets)
          : Promise.resolve({
              data: [] as { wallet_address: string; tier: string; expires_at: string | null }[],
              error: null,
            }),
        postIds.length > 0
          ? supabase.from('posts').select('id, content').in('id', postIds)
          : Promise.resolve({ data: [] as { id: string; content: string }[], error: null }),
      ])

      if (profilesRes.error) console.warn('[MUSYAWARAH] Gagal ngambil avatar actor notifikasi:', profilesRes.error)
      if (verificationsRes.error)
        console.warn('[MUSYAWARAH] Gagal ngambil tier verifikasi actor notifikasi:', verificationsRes.error)
      if (postsRes.error) console.warn('[MUSYAWARAH] Gagal ngambil cuplikan post notifikasi:', postsRes.error)

      const avatarByWallet = new Map((profilesRes.data ?? []).map((p) => [p.wallet_address, p.avatar_url]))

      const now = Date.now()
      const tierByWallet = new Map(
        (verificationsRes.data ?? [])
          .filter((v) => !v.expires_at || new Date(v.expires_at).getTime() > now)
          .map((v) => [v.wallet_address, v.tier as VerificationTier])
      )

      const previewByPostId = new Map((postsRes.data ?? []).map((p) => [p.id, p.content]))

      setNotifications(
        rows.map((n) => ({
          ...n,
          actor_avatar_url: avatarByWallet.get(n.actor_wallet) ?? null,
          actor_verification_tier: tierByWallet.get(n.actor_wallet),
          post_preview: n.post_id ? (previewByPostId.get(n.post_id) ?? null) : null,
        }))
      )
    } catch (e) {
      setError('Failed to load notifications.')
      console.error('[MUSYAWARAH] Gagal ngambil notifikasi:', e)
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!walletAddress) return
    const interval = setInterval(refresh, 10000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [walletAddress, refresh])

  const unreadCount = notifications.reduce((sum, n) => sum + (n.read ? 0 : 1), 0)

  const markAllRead = useCallback(async () => {
    if (!walletAddress) return
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return

    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })))

    const { error: updateError } = await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    if (updateError) console.warn('[MUSYAWARAH] Gagal nandain notifikasi udah dibaca:', updateError)
  }, [walletAddress, notifications])

  return { notifications, loading, error, refresh, unreadCount, markAllRead }
}
