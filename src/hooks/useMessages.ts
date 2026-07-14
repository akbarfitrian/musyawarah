import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import type { Conversation, ListingSnapshot, Message } from '../types'

export function useConversations() {
  const { walletAddress } = useWallet()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (!walletAddress) {
        setConversations([])
        setLoading(false)
        return
      }
      if (showSpinner) setLoading(true)
      setError(null)
      try {
        const { data, error: queryError } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_wallet.eq.${walletAddress},receiver_wallet.eq.${walletAddress}`)
          .order('created_at', { ascending: false })
          .limit(500)

        if (queryError) throw queryError

        const byWallet = new Map<string, Conversation>()
        for (const m of (data ?? []) as Message[]) {
          const other = m.sender_wallet === walletAddress ? m.receiver_wallet : m.sender_wallet
          const isUnread = m.receiver_wallet === walletAddress && !m.read

          const existing = byWallet.get(other)
          if (!existing) {
            byWallet.set(other, { wallet_address: other, last_message: m, unread_count: isUnread ? 1 : 0, avatar_url: null })
          } else if (isUnread) {
            existing.unread_count += 1
          }
        }

        const list = [...byWallet.values()].sort(
          (a, b) => new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
        )

        const otherWallets = list.map((c) => c.wallet_address)
        if (otherWallets.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('wallet_address, avatar_url')
            .in('wallet_address', otherWallets)

          if (profilesError) {
            console.warn('[MUSYAWARAH] Gagal ngambil foto profil buat daftar pesan:', profilesError)
          } else {
            const avatarByWallet = (profilesData ?? []).reduce(
              (acc, p) => {
                acc[p.wallet_address] = p.avatar_url
                return acc
              },
              {} as Record<string, string | null>
            )
            for (const c of list) {
              c.avatar_url = avatarByWallet[c.wallet_address] ?? null
            }
          }

          const { data: verificationsData, error: verificationsError } = await supabase
            .from('verifications')
            .select('wallet_address, tier, expires_at')
            .in('wallet_address', otherWallets)

          if (verificationsError) {
            console.warn('[MUSYAWARAH] Gagal ngambil status verifikasi buat daftar pesan:', verificationsError)
          } else {
            const tierByWallet = (verificationsData ?? []).reduce(
              (acc, v) => {
                const isExpired = Boolean(v.expires_at) && new Date(v.expires_at as string).getTime() <= Date.now()
                if (!isExpired) acc[v.wallet_address] = v.tier as Conversation['verification_tier']
                return acc
              },
              {} as Record<string, Conversation['verification_tier']>
            )
            for (const c of list) {
              c.verification_tier = tierByWallet[c.wallet_address]
            }
          }
        }

        setConversations((prev) => {
          const sameLength = prev.length === list.length
          const sameContent =
            sameLength &&
            prev.every(
              (c, i) =>
                c.wallet_address === list[i].wallet_address &&
                c.last_message.id === list[i].last_message.id &&
                c.unread_count === list[i].unread_count &&
                c.avatar_url === list[i].avatar_url &&
                c.verification_tier === list[i].verification_tier
            )
          return sameContent ? prev : list
        })
      } catch (e) {
        if (showSpinner) setError('Failed to load messages. Check your Supabase connection.')
        console.error(e)
      } finally {
        if (showSpinner) setLoading(false)
      }
    },
    [walletAddress]
  )

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!walletAddress) return
    const tick = () => {
      if (document.visibilityState === 'visible') load(false)
    }
    const interval = setInterval(tick, 5000)
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
  }, [walletAddress, load])

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0)

  return { conversations, loading, error, refresh, totalUnread }
}

export function useThread(otherWallet: string | null) {
  const { walletAddress } = useWallet()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (!walletAddress || !otherWallet) {
        setMessages([])
        setLoading(false)
        return
      }
      if (showSpinner) setLoading(true)
      setError(null)
      try {
        const { data, error: queryError } = await supabase
          .from('messages')
          .select('*')
          .or(
            `and(sender_wallet.eq.${walletAddress},receiver_wallet.eq.${otherWallet}),and(sender_wallet.eq.${otherWallet},receiver_wallet.eq.${walletAddress})`
          )
          .order('created_at', { ascending: true })
          .limit(200)

        if (queryError) throw queryError
        const thread = (data ?? []) as Message[]

        setMessages((prev) => {
          const sameLength = prev.length === thread.length
          const sameContent =
            sameLength &&
            prev.every(
              (m, i) =>
                m.id === thread[i].id &&
                m.read === thread[i].read &&
                m.payload === thread[i].payload &&
                m.deleted === thread[i].deleted
            )
          return sameContent ? prev : thread
        })

        const hasUnread = thread.some((m) => m.receiver_wallet === walletAddress && !m.read)
        if (hasUnread) {
          const { error: rpcError } = await supabase.rpc('mark_thread_read', {
            p_wallet: walletAddress,
            p_other_wallet: otherWallet,
          })
          if (rpcError) console.warn('[MUSYAWARAH] Gagal nandain pesan udah dibaca:', rpcError)
        }
      } catch (e) {
        if (showSpinner) setError('Failed to load conversation.')
        console.error(e)
      } finally {
        if (showSpinner) setLoading(false)
      }
    },
    [walletAddress, otherWallet]
  )

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!walletAddress || !otherWallet) return
    const tick = () => {
      if (document.visibilityState === 'visible') load(false)
    }
    const interval = setInterval(tick, 3000)
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
  }, [walletAddress, otherWallet, load])

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!walletAddress || !otherWallet || !trimmed) return

      setSending(true)
      try {
        const { data, error: rpcError } = await supabase.rpc('send_message', {
          p_sender: walletAddress,
          p_receiver: otherWallet,
          p_content: trimmed,
          p_kind: 'text',
        })

        if (rpcError) throw rpcError
        setMessages((prev) => [...prev, data as Message])
      } finally {
        setSending(false)
      }
    },
    [walletAddress, otherWallet]
  )

  const sendOffer = useCallback(
    async (postId: string, amount: number, coinSymbol = 'UCT') => {
      if (!walletAddress || !otherWallet) return
      setSending(true)
      try {
        const { data, error: rpcError } = await supabase.rpc('propose_offer', {
          p_sender: walletAddress,
          p_receiver: otherWallet,
          p_post_id: postId,
          p_amount: amount,
          p_coin_symbol: coinSymbol,
        })

        if (rpcError) throw rpcError
        setMessages((prev) => [...prev, data as Message])
      } finally {
        setSending(false)
      }
    },
    [walletAddress, otherWallet]
  )

  const acceptOffer = useCallback(
    async (messageId: string) => {
      if (!walletAddress) return
      const { data, error: rpcError } = await supabase.rpc('accept_offer', {
        p_message_id: messageId,
        p_caller_wallet: walletAddress,
      })

      if (rpcError) throw rpcError
      await refresh()
      return data as Message
    },
    [walletAddress, refresh]
  )

  const declineOffer = useCallback(
    async (messageId: string) => {
      if (!walletAddress) return
      const { data, error: rpcError } = await supabase.rpc('decline_offer', {
        p_message_id: messageId,
        p_caller_wallet: walletAddress,
      })

      if (rpcError) throw rpcError
      setMessages((prev) => prev.map((m) => (m.id === messageId ? (data as Message) : m)))
      return data as Message
    },
    [walletAddress]
  )

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!walletAddress) return
      const { data, error: rpcError } = await supabase.rpc('delete_message', {
        p_message_id: messageId,
        p_caller_wallet: walletAddress,
      })

      if (rpcError) throw rpcError
      setMessages((prev) => prev.map((m) => (m.id === messageId ? (data as Message) : m)))
      return data as Message
    },
    [walletAddress]
  )

  return {
    messages,
    loading,
    error,
    sending,
    refresh,
    sendMessage,
    sendOffer,
    acceptOffer,
    declineOffer,
    deleteMessage,
  }
}

export async function sendListingRefMessage(senderWallet: string, receiverWallet: string, postId: string) {
  const { error } = await supabase.rpc('send_message', {
    p_sender: senderWallet,
    p_receiver: receiverWallet,
    p_kind: 'listing_ref',
    p_payload: { post_id: postId },
  })
  if (error) throw error
}

export function useProviderListings(providerWallet: string | null) {
  const [listings, setListings] = useState<ListingSnapshot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!providerWallet) {
      setListings([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .from('posts')
      .select(
        'id, listing_title, listing_category, listing_price_amount, listing_price_mode, listing_coin_symbol, listing_active, author_wallet'
      )
      .eq('author_wallet', providerWallet)
      .eq('is_listing', true)
      .eq('listing_active', true)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[MUSYAWARAH] Gagal ngambil listing aktif lawan bicara:', error)
          setListings([])
        } else {
          setListings((data ?? []) as ListingSnapshot[])
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [providerWallet])

  return { listings, loading }
}

export function useListingSnapshots(messages: Message[]) {
  const [snapshots, setSnapshots] = useState<Record<string, ListingSnapshot>>({})

  useEffect(() => {
    const postIds = [
      ...new Set(
        messages
          .filter((m) => m.kind === 'listing_ref' || m.kind === 'offer')
          .map((m) => (m.payload as { post_id?: string } | null)?.post_id)
          .filter((id): id is string => Boolean(id))
      ),
    ]

    if (postIds.length === 0) {
      setSnapshots({})
      return
    }

    let cancelled = false
    supabase
      .from('posts')
      .select(
        'id, listing_title, listing_category, listing_price_amount, listing_price_mode, listing_coin_symbol, listing_active, author_wallet'
      )
      .in('id', postIds)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[MUSYAWARAH] Gagal ngambil ringkasan listing buat kartu chat:', error)
          return
        }
        const byId: Record<string, ListingSnapshot> = {}
        for (const row of (data ?? []) as ListingSnapshot[]) {
          byId[row.id] = row
        }
        setSnapshots(byId)
      })

    return () => {
      cancelled = true
    }
  }, [messages.map((m) => m.id).join(',')])

  return snapshots
}
