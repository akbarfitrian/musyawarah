import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import type { VerificationTier } from '../lib/verification'
import type { Post } from '../types'

/** Ambil satu post by id, dilengkapi total tip/repost/avatar/tier verifikasi
 * -- versi "single item" dari usePosts.ts, dipakai buat halaman permalink
 * post (PostPage.tsx / route #/post/:id). */
export function usePost(postId: string | undefined) {
  const { walletAddress } = useWallet()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const refresh = useCallback(async () => {
    if (!postId) {
      setPost(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setNotFound(false)

    try {
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .maybeSingle()

      if (postError) throw postError
      if (!postData) {
        setPost(null)
        setNotFound(true)
        return
      }

      const [tipsResult, repostsResult, profileResult, verificationResult] = await Promise.all([
        supabase.from('tips').select('amount').eq('post_id', postId),
        supabase.from('reposts').select('wallet_address').eq('post_id', postId),
        supabase.from('profiles').select('avatar_url').eq('wallet_address', postData.author_wallet).maybeSingle(),
        supabase
          .from('verifications')
          .select('tier, expires_at')
          .eq('wallet_address', postData.author_wallet)
          .maybeSingle(),
      ])

      const tipTotal = (tipsResult.data ?? []).reduce((sum, t) => sum + Number(t.amount), 0)
      const repostRows = repostsResult.data ?? []
      const repostTotal = repostRows.length
      const repostedByMe = walletAddress ? repostRows.some((r) => r.wallet_address === walletAddress) : false

      const verification = verificationResult.data
      const isExpired = Boolean(verification?.expires_at) && new Date(verification!.expires_at as string).getTime() <= Date.now()

      setPost({
        ...(postData as Post),
        tip_total: tipTotal,
        repost_total: repostTotal,
        reposted_by_me: repostedByMe,
        author_avatar_url: profileResult.data?.avatar_url ?? null,
        author_verification_tier: verification && !isExpired ? (verification.tier as VerificationTier) : undefined,
      })
    } catch (e) {
      setError('Failed to load this post.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [postId, walletAddress])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { post, loading, error, notFound, refresh }
}
