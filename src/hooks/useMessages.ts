import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import type { Conversation, ListingSnapshot, Message } from '../types'

// ============================================================================
// DIRECT MESSAGES — "ala kadarnya", sama kayak posts/reposts: query langsung
// dari klien + dikelompokkan di JS, bukan lewat view/RPC di Supabase. Cukup
// buat skala kecil; kalau volume pesan udah gede, pindahin logic grouping-nya
// ke SQL view biar nggak nge-load semua baris ke klien.
// ============================================================================

/** Daftar percakapan wallet yang lagi connect, satu baris per lawan bicara,
 * diurutin dari yang paling baru dibalas. */
export function useConversations() {
  const { walletAddress } = useWallet()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      setConversations([])
      setLoading(false)
      return
    }
    setLoading(true)
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
          // data udah diurutin created_at desc, jadi baris pertama per wallet
          // otomatis jadi pesan paling baru buat preview-nya.
          byWallet.set(other, { wallet_address: other, last_message: m, unread_count: isUnread ? 1 : 0, avatar_url: null })
        } else if (isUnread) {
          existing.unread_count += 1
        }
      }

      const list = [...byWallet.values()].sort(
        (a, b) => new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
      )

      // Foto profil lawan bicara ("ala kadarnya" -- kalau query ini gagal,
      // daftar pesan tetap jalan pakai avatar warna generated, errornya
      // cuma di-log, sama kayak pola di usePosts.ts).
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
      }

      setConversations(list)
    } catch (e) {
      setError('Failed to load messages. Check your Supabase connection.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Polling ringan buat badge notifikasi pesan baru. App ini belum pakai
  // Supabase Realtime (butuh diaktifin manual per-tabel di dashboard), jadi
  // ini cara paling simpel biar unread count di tombol Messages keupdate
  // sendiri tanpa harus pindah tab / reload pas ada pesan baru masuk.
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

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0)

  return { conversations, loading, error, refresh, totalUnread }
}

/** Satu percakapan 1-on-1 antara wallet yang lagi connect dan `otherWallet`. */
export function useThread(otherWallet: string | null) {
  const { walletAddress } = useWallet()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const refresh = useCallback(async () => {
    if (!walletAddress || !otherWallet) {
      setMessages([])
      setLoading(false)
      return
    }
    setLoading(true)
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
      setMessages(thread)

      // Tandai pesan masuk dari lawan bicara ini sebagai udah dibaca begitu
      // thread-nya dibuka. Lewat RPC (bukan .update() langsung) karena hak
      // UPDATE ke `messages` dicabut di 007_marketplace_negotiation.sql.
      const hasUnread = thread.some((m) => m.receiver_wallet === walletAddress && !m.read)
      if (hasUnread) {
        const { error: rpcError } = await supabase.rpc('mark_thread_read', {
          p_wallet: walletAddress,
          p_other_wallet: otherWallet,
        })
        if (rpcError) console.warn('[MUSYAWARAH] Gagal nandain pesan udah dibaca:', rpcError)
      }
    } catch (e) {
      setError('Failed to load conversation.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [walletAddress, otherWallet])

  useEffect(() => {
    refresh()
  }, [refresh])

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

  /** Kirim tawaran harga buat suatu listing -- muncul sebagai bubble `offer`
   * yang bisa di-Accept/Decline sama lawan bicara (lihat propose_offer §2). */
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

  /** Terima tawaran (cuma boleh dipanggil sama penerimanya) -- bikin `orders`
   * status 'pending' + pesan sistem `order_update` otomatis di server. */
  const acceptOffer = useCallback(
    async (messageId: string) => {
      if (!walletAddress) return
      const { data, error: rpcError } = await supabase.rpc('accept_offer', {
        p_message_id: messageId,
        p_caller_wallet: walletAddress,
      })

      if (rpcError) throw rpcError
      await refresh() // ambil ulang thread biar pesan order_update otomatis ikut kebaca
      return data as Message
    },
    [walletAddress, refresh]
  )

  /** Tolak tawaran (cuma boleh dipanggil sama penerimanya). */
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

  return { messages, loading, error, sending, refresh, sendMessage, sendOffer, acceptOffer, declineOffer }
}

/** Kirim kartu listing sebagai pesan pertama pas buyer klik "Nego & Hire" di
 * kartu listing (draft §1b: "dikirim otomatis sebagai pesan pertama"). Bukan
 * hook -- dipanggil sekali dari App.tsx sebelum pindah ke halaman DM, jadi
 * gak perlu subscribe ke thread manapun. */
export async function sendListingRefMessage(senderWallet: string, receiverWallet: string, postId: string) {
  const { error } = await supabase.rpc('send_message', {
    p_sender: senderWallet,
    p_receiver: receiverWallet,
    p_kind: 'listing_ref',
    p_payload: { post_id: postId },
  })
  if (error) throw error
}

/** Ambil ringkasan (title/harga/kategori/dst) buat sekumpulan post_id yang
 * dipakai di kartu `listing_ref`/`offer` sepanjang satu thread -- di-batch
 * sekali per refresh, sama pola-nya kayak avatarByWallet di useConversations
 * di atas, biar gak query per-bubble. */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.map((m) => m.id).join(',')])

  return snapshots
}
