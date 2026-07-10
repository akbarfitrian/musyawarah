import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import type { VerificationTier } from '../lib/verification'
import type { Post, Repost, Tip } from '../types'

/** Provider tutup/buka listing tanpa hapus post-nya (Fase 4, `MarketplacePage`
 * sub-tab "My Listings") -- panggil `set_listing_active` RPC, `posts.update`
 * langsung sudah dicabut haknya dari client sejak 002_harden_writes.sql. */
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

  // `showSpinner` cuma true buat load pertama kali / manual refresh (mis.
  // abis nge-post sendiri). Auto-sync di bawah (polling + refresh pas tab
  // difokusin lagi) manggil versi silent-nya biar post baru dari user lain
  // numpuk ke feed tanpa nge-reset `loading` -- soalnya kalau di-toggle tiap
  // beberapa detik, feed jadi keliatan "berkedip" / posisi scroll kebuang ke
  // atas padahal belum tentu ada post baru.
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

        // sort_at dipakai buat nge-urutin feed: post biasa diurutin dari waktu
        // dia dibikin, tapi post yang muncul di profil karena di-repost diurutin
        // dari waktu repost-nya (biar "naik" ke atas kayak retweet di Twitter).
        type PostWithSort = Post & { sort_at: string }
        let combined: PostWithSort[] = (authoredData ?? []).map((p) => ({ ...p, sort_at: p.created_at }))

        // Kalau lagi liat profil orang/diri sendiri (authorWallet keisi), post
        // yang di-repost sama wallet itu juga harus nongol di profilnya —
        // sama kayak retweet yang nampil di profil Twitter.
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

        const ids = postsData.map((p) => p.id)
        const wallets = [...new Set(postsData.map((p) => p.author_wallet))]
        let tipTotals: Record<string, number> = {}
        let avatarByWallet: Record<string, string | null> = {}
        let repostTotals: Record<string, number> = {}
        let repostedByMe: Record<string, boolean> = {}
        let verificationTierByWallet: Record<string, VerificationTier> = {}

        if (ids.length > 0) {
          const { data: tipsData, error: tipsError } = await supabase
            .from('tips')
            .select('post_id, amount')
            .in('post_id', ids)

          if (tipsError) throw tipsError
          tipTotals = (tipsData as Pick<Tip, 'post_id' | 'amount'>[]).reduce(
            (acc, t) => {
              acc[t.post_id] = (acc[t.post_id] ?? 0) + Number(t.amount)
              return acc
            },
            {} as Record<string, number>
          )

          const { data: repostsData, error: repostsError } = await supabase
            .from('reposts')
            .select('post_id, wallet_address')
            .in('post_id', ids)

          if (repostsError) {
            // "ala kadarnya" — kalau query repost gagal, feed tetap jalan
            // tanpa hitungan repost, errornya cuma di-log.
            console.warn('[MUSYAWARAH] Gagal ngambil data repost:', repostsError)
          } else {
            repostTotals = (repostsData as Pick<Repost, 'post_id' | 'wallet_address'>[]).reduce(
              (acc, r) => {
                acc[r.post_id] = (acc[r.post_id] ?? 0) + 1
                return acc
              },
              {} as Record<string, number>
            )
            if (walletAddress) {
              repostedByMe = (repostsData as Pick<Repost, 'post_id' | 'wallet_address'>[]).reduce(
                (acc, r) => {
                  if (r.wallet_address === walletAddress) acc[r.post_id] = true
                  return acc
                },
                {} as Record<string, boolean>
              )
            }
          }
        }

        if (wallets.length > 0) {
          // Foto profil ("ala kadarnya" — kalau query ini gagal, feed tetap
          // jalan pakai avatar warna generated, jadi errornya cuma di-log).
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('wallet_address, avatar_url')
            .in('wallet_address', wallets)

          if (profilesError) {
            console.warn('[MUSYAWARAH] Gagal ngambil foto profil buat feed:', profilesError)
          } else {
            avatarByWallet = (profilesData ?? []).reduce(
              (acc, p) => {
                acc[p.wallet_address] = p.avatar_url
                return acc
              },
              {} as Record<string, string | null>
            )
          }

          // Tier verifikasi ("ala kadarnya" -- kalau query ini gagal, feed
          // tetap jalan tanpa badge centang/berlian, errornya cuma di-log).
          // Langganan yang udah lewat expires_at-nya nggak dianggap aktif lagi
          // (badge-nya nggak ditampilin) -- sama kayak logic di useVerification.ts.
          const { data: verificationsData, error: verificationsError } = await supabase
            .from('verifications')
            .select('wallet_address, tier, expires_at')
            .in('wallet_address', wallets)

          if (verificationsError) {
            console.warn('[MUSYAWARAH] Gagal ngambil status verifikasi buat feed:', verificationsError)
          } else {
            verificationTierByWallet = (verificationsData ?? []).reduce(
              (acc, v) => {
                const isExpired = Boolean(v.expires_at) && new Date(v.expires_at as string).getTime() <= Date.now()
                if (!isExpired) acc[v.wallet_address] = v.tier as VerificationTier
                return acc
              },
              {} as Record<string, VerificationTier>
            )
          }
        }

        const withTotals: Post[] = postsData.map((p) => ({
          ...p,
          tip_total: tipTotals[p.id] ?? 0,
          author_avatar_url: avatarByWallet[p.author_wallet] ?? null,
          repost_total: repostTotals[p.id] ?? 0,
          reposted_by_me: repostedByMe[p.id] ?? false,
          author_verification_tier: verificationTierByWallet[p.author_wallet],
        }))

        // Sama kayak useThread/useConversations -- cuma nge-set state kalau
        // beneran ada perubahan (post baru, tip/repost total berubah, dst),
        // biar polling silent-nya nggak nge-trigger re-render/scroll reset
        // kalau nggak ada yang baru.
        setPosts((prev) => {
          const sameLength = prev.length === withTotals.length
          const sameContent =
            sameLength &&
            prev.every(
              (p, i) =>
                p.id === withTotals[i].id &&
                p.tip_total === withTotals[i].tip_total &&
                p.repost_total === withTotals[i].repost_total &&
                p.reposted_by_me === withTotals[i].reposted_by_me &&
                p.author_avatar_url === withTotals[i].author_avatar_url &&
                p.author_verification_tier === withTotals[i].author_verification_tier
            )
          return sameContent ? prev : withTotals
        })
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

  // Auto-sync: feed di-poll tiap 8 detik biar post baru dari user lain
  // langsung nongol tanpa harus pindah-pindah tab/fitur biar ke-refresh.
  // Di-pause pas tab nggak aktif biar hemat request, dan langsung nge-sync
  // begitu tab difokusin/di-switch lagi.
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
