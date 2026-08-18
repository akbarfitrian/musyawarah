import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import { enrichPosts, samePostList } from './postEnrichment'
import type { ListingCategory } from '../config/listingCategories'
import type { Post } from '../types'

export type ListingSort = 'newest' | 'price_asc' | 'price_desc'

const PAGE_SIZE = 24

/**
 * Browse-all-listings query for the Marketplace "Browse" tab. Unlike
 * usePosts (which pulls the latest N posts of any kind, listing or not),
 * this filters `is_listing = true AND listing_active = true` directly in
 * the query so results are always representative of what's for sale, and
 * supports server-side category filtering + price sorting.
 */
export function useListings({ categories, sort }: { categories: ListingCategory[]; sort: ListingSort }) {
  const { walletAddress } = useWallet()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchPage = useCallback(
    async (offset: number) => {
      let query = supabase
        .from('posts')
        .select('*')
        .eq('is_listing', true)
        .eq('listing_active', true)

      if (categories.length > 0) {
        query = query.in('listing_category', categories)
      }

      if (sort === 'price_asc') {
        query = query.order('listing_price_amount', { ascending: true, nullsFirst: false })
      } else if (sort === 'price_desc') {
        query = query.order('listing_price_amount', { ascending: false, nullsFirst: false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const { data, error: queryError } = await query.range(offset, offset + PAGE_SIZE - 1)
      if (queryError) throw queryError
      return (data ?? []) as Post[]
    },
    [categories, sort]
  )

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true)
      setError(null)
      try {
        const page = await fetchPage(0)
        const withTotals = await enrichPosts(page, walletAddress)
        setPosts((prev) => (samePostList(prev, withTotals) ? prev : withTotals))
        setHasMore(page.length === PAGE_SIZE)
      } catch (e) {
        if (showSpinner) setError('Failed to load listings. Check your Supabase connection.')
        console.error(e)
      } finally {
        if (showSpinner) setLoading(false)
      }
    },
    [fetchPage, walletAddress]
  )

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const page = await fetchPage(posts.length)
      const withTotals = await enrichPosts(page, walletAddress)
      setPosts((prev) => [...prev, ...withTotals])
      setHasMore(page.length === PAGE_SIZE)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMore(false)
    }
  }, [fetchPage, hasMore, loadingMore, posts.length, walletAddress])

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { posts, loading, error, hasMore, loadingMore, loadMore, refresh }
}
