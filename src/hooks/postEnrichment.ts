import { supabase } from '../supabaseClient'
import type { VerificationTier } from '../lib/verification'
import type { Post, Repost, Tip } from '../types'

/**
 * Takes raw rows from `posts` and attaches everything PostCard/Feed need to
 * render: tip totals, repost totals, author avatar, verification tier, and
 * order counts (for listings). Shared between usePosts and useListings so
 * the ~100 lines of batched lookups only live in one place.
 */
export async function enrichPosts(postsData: Post[], viewerWallet?: string | null): Promise<Post[]> {
  const ids = postsData.map((p) => p.id)
  const wallets = [...new Set(postsData.map((p) => p.author_wallet))]
  let tipTotals: Record<string, number> = {}
  let avatarByWallet: Record<string, string | null> = {}
  let repostTotals: Record<string, number> = {}
  let repostedByMe: Record<string, boolean> = {}
  let verificationTierByWallet: Record<string, VerificationTier> = {}

  if (ids.length > 0) {
    const { data: tipsData, error: tipsError } = await supabase.from('tips').select('post_id, amount').in('post_id', ids)

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
      console.warn('[MUSYAWARAH] Gagal ngambil data repost:', repostsError)
    } else {
      repostTotals = (repostsData as Pick<Repost, 'post_id' | 'wallet_address'>[]).reduce(
        (acc, r) => {
          acc[r.post_id] = (acc[r.post_id] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
      if (viewerWallet) {
        repostedByMe = (repostsData as Pick<Repost, 'post_id' | 'wallet_address'>[]).reduce(
          (acc, r) => {
            if (r.wallet_address === viewerWallet) acc[r.post_id] = true
            return acc
          },
          {} as Record<string, boolean>
        )
      }
    }
  }

  let orderCounts: Record<string, number> = {}
  let completedOrderCounts: Record<string, number> = {}
  const listingIds = postsData.filter((p) => p.is_listing).map((p) => p.id)
  if (listingIds.length > 0) {
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('post_id, status')
      .in('post_id', listingIds)

    if (ordersError) {
      console.warn('[MUSYAWARAH] Gagal ngambil data order buat listing:', ordersError)
    } else {
      for (const o of (ordersData ?? []) as { post_id: string; status: string }[]) {
        orderCounts[o.post_id] = (orderCounts[o.post_id] ?? 0) + 1
        if (o.status === 'completed' || o.status === 'released') {
          completedOrderCounts[o.post_id] = (completedOrderCounts[o.post_id] ?? 0) + 1
        }
      }
    }
  }

  if (wallets.length > 0) {
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

  return postsData.map((p) => ({
    ...p,
    tip_total: tipTotals[p.id] ?? 0,
    author_avatar_url: avatarByWallet[p.author_wallet] ?? null,
    repost_total: repostTotals[p.id] ?? 0,
    reposted_by_me: repostedByMe[p.id] ?? false,
    author_verification_tier: verificationTierByWallet[p.author_wallet],
    order_count: orderCounts[p.id] ?? 0,
    completed_order_count: completedOrderCounts[p.id] ?? 0,
  }))
}

/** Shallow-ish equality check so setState calls don't trigger needless re-renders. */
export function samePostList(prev: Post[], next: Post[]): boolean {
  if (prev.length !== next.length) return false
  return prev.every(
    (p, i) =>
      p.id === next[i].id &&
      p.tip_total === next[i].tip_total &&
      p.repost_total === next[i].repost_total &&
      p.reposted_by_me === next[i].reposted_by_me &&
      p.author_avatar_url === next[i].author_avatar_url &&
      p.author_verification_tier === next[i].author_verification_tier &&
      p.order_count === next[i].order_count &&
      p.completed_order_count === next[i].completed_order_count
  )
}
