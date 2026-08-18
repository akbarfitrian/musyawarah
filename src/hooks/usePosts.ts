import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import { enrichPosts, samePostList } from './postEnrichment'
import type { Post } from '../types'

export async function setListingActive(wallet: string, postId: string, active: boolean) {
  const { error } = await supabase.rpc('set_listing_active', {
    p_wallet: wallet,
    p_post_id: postId,
    p_active: active,
  })
  if (error) throw error
}

export function usePosts(authorWallet?: string) {
  const { walletAddress } = useWallet()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true)
      setError(null)
      try {
        let query = supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(50)

        if (authorWallet) {
          query = query.eq('author_wallet', authorWallet)
        }

        const { data: authoredData, error: postsError } = await query

        if (postsError) throw postsError

        type PostWithSort = Post & { sort_at: string }
        let combined: PostWithSort[] = (authoredData ?? []).map((p) => ({ ...p, sort_at: p.created_at }))

        if (authorWallet) {
          const { data: myRepostsData, error: myRepostsError } = await supabase
            .from('reposts')
            .select('post_id, created_at')
            .eq('wallet_address', authorWallet)

          if (myRepostsError) {
            console.warn('[MUSYAWARAH] Gagal ngambil repost buat profil:', myRepostsError)
          } else if (myRepostsData && myRepostsData.length > 0) {
            const authoredIds = new Set(combined.map((p) => p.id))
            const repostedIds = myRepostsData.map((r) => r.post_id).filter((id) => !authoredIds.has(id))

            if (repostedIds.length > 0) {
              const { data: repostedPostsData, error: repostedPostsError } = await supabase
                .from('posts')
                .select('*')
                .in('id', repostedIds)

              if (repostedPostsError) {
                console.warn('[MUSYAWARAH] Gagal ngambil isi post yang di-repost:', repostedPostsError)
              } else {
                const repostTimeByPostId = myRepostsData.reduce(
                  (acc, r) => {
                    acc[r.post_id] = r.created_at
                    return acc
                  },
                  {} as Record<string, string>
                )

                const repostedAsPosts: PostWithSort[] = (repostedPostsData ?? []).map((p) => ({
                  ...p,
                  reposted_by_wallet: authorWallet,
                  sort_at: repostTimeByPostId[p.id] ?? p.created_at,
                }))

                combined = [...combined, ...repostedAsPosts]
              }
            }
          }
        }

        combined.sort((a, b) => new Date(b.sort_at).getTime() - new Date(a.sort_at).getTime())
        const postsData = combined.slice(0, 50)

        const withTotals = await enrichPosts(postsData, walletAddress)

        setPosts((prev) => (samePostList(prev, withTotals) ? prev : withTotals))
      } catch (e) {
        if (showSpinner) setError('Failed to load feed. Check your Supabase connection.')
        console.error(e)
      } finally {
        if (showSpinner) setLoading(false)
      }
    },
    [authorWallet, walletAddress]
  )

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') load(false)
    }
    const interval = setInterval(tick, 8000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(false)
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  return { posts, loading, error, refresh }
}
