import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ConnectClient, SPHERE_NETWORKS, WALLET_EVENTS } from '@unicitylabs/sphere-sdk/connect'
import { PostMessageTransport } from '@unicitylabs/sphere-sdk/connect/browser'
import { supabase } from '../supabaseClient'
import {
  DEFAULT_UCT_DECIMALS,
  formatRecipient,
  getDappDescriptor,
  identityToHandle,
  isValidHexCoinId,
  parseFiatTotal,
  parseWalletAssets,
  toBaseUnits,
  type SphereConnectionMode,
  type SphereIdentity,
  type WalletAsset,
} from '../lib/sphereConnect'

interface ResolvedCoin {
  coinId: string
  decimals: number
}

interface WalletContextValue {
  walletAddress: string | null
  connecting: boolean
  isAutoConnecting: boolean
  isWalletLocked: boolean
  connectionMode: SphereConnectionMode | null
  error: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendTip: (toWallet: string, amount: number) => Promise<{ txHash: string; simulated: boolean; verified: boolean }>
  assets: WalletAsset[]
  totalFiat: number | null
  balanceLoading: boolean
  refreshBalance: () => Promise<void>
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)

interface HistoryEntryLike {
  type?: string
  amount?: string | number
  timestamp?: number
  transferId?: string
  id?: string
  recipientNametag?: string
  recipientAddress?: string
  recipientPubkey?: string
}

function normalizeHandle(value: string): string {
  return value.replace(/^DIRECT:\/\//, '').replace(/^@/, '').toLowerCase().trim()
}

/**
 * Finds the most recent outgoing ('SENT') entry in the wallet's own history
 * that matches the recipient and amount we just tried to send. Used so we can
 * record the SAME identifier the wallet's "Transaction History" UI shows,
 * instead of guessing at the shape of the intent('send') response.
 */
function findMatchingSentHistoryEntry(
  history: unknown,
  opts: { toWallet: string; amountBase: string; sinceMs: number }
): { transferId?: string; id?: string } | undefined {
  if (!Array.isArray(history)) return undefined
  const targetHandle = normalizeHandle(opts.toWallet)

  const candidates = (history as HistoryEntryLike[]).filter((e) => {
    if (e?.type !== 'SENT') return false
    if (typeof e.timestamp === 'number' && e.timestamp < opts.sinceMs) return false
    if (String(e.amount ?? '') !== opts.amountBase) return false
    const nametag = e.recipientNametag ? normalizeHandle(e.recipientNametag) : ''
    const address = e.recipientAddress ? normalizeHandle(e.recipientAddress) : ''
    const pubkey = e.recipientPubkey ? normalizeHandle(e.recipientPubkey) : ''
    return nametag === targetHandle || address === targetHandle || pubkey === targetHandle
  })

  if (candidates.length === 0) return undefined

  candidates.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
  const best = candidates[0]
  return { transferId: best.transferId, id: best.id }
}

async function resolveUctCoin(client: ConnectClient): Promise<ResolvedCoin> {
  const findUct = (list: unknown): { coinId?: string; decimals?: number } | undefined => {
    if (!Array.isArray(list)) return undefined
    return list.find((item) => {
      const symbol = String(
        (item as Record<string, unknown>)?.symbol ??
          (item as Record<string, unknown>)?.ticker ??
          (item as Record<string, unknown>)?.name ??
          ''
      ).toUpperCase()
      return symbol === 'UCT'
    }) as { coinId?: string; decimals?: number } | undefined
  }

  try {
    const assets = await client.query('sphere_getAssets')
    const list = Array.isArray(assets) ? assets : (assets as { assets?: unknown })?.assets
    const uct = findUct(list)
    const coinId = uct?.coinId ?? (uct as Record<string, unknown>)?.id
    if (isValidHexCoinId(coinId)) {
      return { coinId, decimals: typeof uct?.decimals === 'number' ? uct.decimals : DEFAULT_UCT_DECIMALS }
    }
    if (typeof coinId === 'string') {
      console.warn('[MUSYAWARAH] sphere_getAssets nemu UCT tapi coinId-nya bukan hex valid, diabaikan:', coinId)
    }
  } catch (err) {
    console.warn('[MUSYAWARAH] sphere_getAssets gagal, coba sphere_getTokens buat cari UCT.', err)
  }

  try {
    const tokens = await client.query('sphere_getTokens')
    const list = Array.isArray(tokens) ? tokens : (tokens as { tokens?: unknown })?.tokens
    const uct = findUct(list)
    const coinId = uct?.coinId ?? (uct as Record<string, unknown>)?.id
    if (isValidHexCoinId(coinId)) {
      return { coinId, decimals: typeof uct?.decimals === 'number' ? uct.decimals : DEFAULT_UCT_DECIMALS }
    }
    if (typeof coinId === 'string') {
      console.warn('[MUSYAWARAH] sphere_getTokens nemu UCT tapi coinId-nya bukan hex valid, diabaikan:', coinId)
    }
  } catch (err) {
    console.warn('[MUSYAWARAH] sphere_getTokens juga gagal cari UCT.', err)
  }

  const override = import.meta.env.VITE_SPHERE_UCT_COIN_ID as string | undefined
  if (isValidHexCoinId(override)) {
    console.warn('[MUSYAWARAH] Nggak nemu coinId UCT dari wallet, pakai VITE_SPHERE_UCT_COIN_ID.')
    return { coinId: override, decimals: DEFAULT_UCT_DECIMALS }
  }

  throw new Error(
    override
      ? 'VITE_SPHERE_UCT_COIN_ID di .env.local bukan hex lowercase genap panjangnya. Cek lagi nilainya.'
      : 'Nggak bisa nemuin coinId token UCT dari wallet. Isi VITE_SPHERE_UCT_COIN_ID di .env.local dengan coinId hex UCT yang bener buat network ini, lalu deploy ulang.'
  )
}

async function recordWalletConnectQuest(handle: string) {
  if (!handle) return
  try {
    const { error } = await supabase.rpc('record_wallet_connect', { p_wallet: handle })
    if (error) throw error
  } catch (e) {
    console.warn('[MUSYAWARAH] Gagal mencatat quest connect wallet:', e)
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [isAutoConnecting, setIsAutoConnecting] = useState(true)
  const [isWalletLocked, setIsWalletLocked] = useState(false)
  const [connectionMode, setConnectionMode] = useState<SphereConnectionMode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [assets, setAssets] = useState<WalletAsset[]>([])
  const [totalFiat, setTotalFiat] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  const clientRef = useRef<ConnectClient | null>(null)
  const transportRef = useRef<{ destroy?: () => void } | null>(null)
  const uctCoinRef = useRef<ResolvedCoin | null>(null)
  const unsubEventsRef = useRef<(() => void) | null>(null)

  const resetLocalState = useCallback(() => {
    unsubEventsRef.current?.()
    unsubEventsRef.current = null
    transportRef.current?.destroy?.()
    transportRef.current = null
    clientRef.current = null
    uctCoinRef.current = null
    setWalletAddress(null)
    setConnectionMode(null)
    setIsWalletLocked(false)
    setAssets([])
    setTotalFiat(null)
  }, [])

  const refreshBalance = useCallback(async () => {
    const client = clientRef.current
    if (!client) return
    setBalanceLoading(true)
    try {
      const [assetsRaw, fiatRaw] = await Promise.all([
        client.query('sphere_getAssets'),
        client.query('sphere_getFiatBalance').catch(() => null),
      ])
      setAssets(parseWalletAssets(assetsRaw))
      setTotalFiat(parseFiatTotal(fiatRaw))
    } catch (err) {
      console.warn('[MUSYAWARAH] Gagal refresh saldo wallet:', err)
    } finally {
      setBalanceLoading(false)
    }
  }, [])

  const attachEvents = useCallback((client: ConnectClient) => {
    const unsubLocked = client.on(WALLET_EVENTS.LOCKED, () => {
      setIsWalletLocked(true)
    })

    const unsubIdentity = client.on(WALLET_EVENTS.IDENTITY_CHANGED, (data: unknown) => {
      setIsWalletLocked(false)
      setWalletAddress(identityToHandle(data as SphereIdentity))
      uctCoinRef.current = null
      refreshBalance()
    })

    const unsubIncoming = client.on('transfer:incoming', () => refreshBalance())
    const unsubConfirmed = client.on('transfer:confirmed', () => refreshBalance())

    return () => {
      unsubLocked()
      unsubIdentity()
      unsubIncoming()
      unsubConfirmed()
    }
  }, [refreshBalance])

  useEffect(() => {
    let cancelled = false

    async function silentConnect() {
      const dapp = getDappDescriptor()

      try {
        const transport = PostMessageTransport.forClient()
        const client = new ConnectClient({
          transport,
          dapp,
          network: SPHERE_NETWORKS.testnet2,
          silent: true,
        })
        const result = await client.connect()
        if (cancelled) return
        clientRef.current = client
        transportRef.current = transport
        setConnectionMode('iframe')
        const handle = identityToHandle(result.identity as SphereIdentity)
        setWalletAddress(handle)
        unsubEventsRef.current = attachEvents(client)
        refreshBalance()
        recordWalletConnectQuest(handle)
      } catch {
      } finally {
        if (!cancelled) setIsAutoConnecting(false)
      }
    }

    silentConnect()

    return () => {
      cancelled = true
      unsubEventsRef.current?.()
    }
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    const dapp = getDappDescriptor()

    try {
      const transport = PostMessageTransport.forClient()
      const client = new ConnectClient({ transport, dapp, network: SPHERE_NETWORKS.testnet2 })
      const result = await client.connect()

      clientRef.current = client
      transportRef.current = transport
      uctCoinRef.current = null
      setConnectionMode('iframe')
      const handle = identityToHandle(result.identity as SphereIdentity)
      setWalletAddress(handle)
      setIsWalletLocked(false)

      unsubEventsRef.current?.()
      unsubEventsRef.current = attachEvents(client)
      refreshBalance()
      recordWalletConnectQuest(handle)
    } catch (err) {
      console.error('[MUSYAWARAH] Gagal connect ke Sphere wallet:', err)
      const message = err instanceof Error ? err.message : 'Failed to connect wallet. Try again.'
      setError(message)
    } finally {
      setConnecting(false)
    }
  }, [attachEvents, refreshBalance])

  const disconnect = useCallback(async () => {
    try {
      await clientRef.current?.disconnect()
    } catch (err) {
      console.warn('[MUSYAWARAH] Error pas disconnect (diabaikan):', err)
    } finally {
      resetLocalState()
    }
  }, [resetLocalState])

  const sendTip = useCallback(async (toWallet: string, amount: number) => {
    const client = clientRef.current
    if (!client || !walletAddress) throw new Error('Wallet not connected')

    if (!uctCoinRef.current) {
      uctCoinRef.current = await resolveUctCoin(client)
    }
    const { coinId, decimals } = uctCoinRef.current
    const amountBase = toBaseUnits(amount, decimals)

    const result = (await client.intent('send', {
      to: formatRecipient(toWallet),
      amount: amountBase,
      coinId,
    })) as {
      txHash?: string
      hash?: string
      tx?: { hash?: string; id?: string }
      transferId?: string
      transfer?: { id?: string; transferId?: string }
      id?: string
      tokenId?: string
      token?: { id?: string }
    }

    // The intent response shape isn't formally documented by the wallet SDK,
    // so this is a best-effort guess at where an identifier might live.
    let identifier =
      result?.txHash ??
      result?.hash ??
      result?.tx?.hash ??
      result?.transferId ??
      result?.transfer?.transferId ??
      result?.transfer?.id ??
      result?.tx?.id ??
      result?.id ??
      result?.tokenId ??
      result?.token?.id ??
      null

    // Cross-check against the wallet's own transaction history and prefer
    // whatever it reports there. This is what the "Transaction History" panel
    // in the wallet itself displays (Transfer ID / Token ID), so recording
    // the same value here means what we store for release/refund proof will
    // actually match what a human can verify in the wallet UI.
    let verified = Boolean(identifier)
    try {
      const history = await client.query<unknown>('sphere_getHistory')
      const match = findMatchingSentHistoryEntry(history, {
        toWallet,
        amountBase,
        sinceMs: Date.now() - 2 * 60 * 1000,
      })
      if (match) {
        identifier = match.transferId ?? match.id ?? identifier
        verified = true
      }
    } catch (err) {
      console.warn(
        '[MUSYAWARAH] sendTip: gagal cross-check ke sphere_getHistory (dilanjut pakai identifier dari intent result kalau ada):',
        err
      )
    }

    if (!identifier) {
      throw new Error(
        'Payment may have been sent, but the wallet did not return a verifiable transaction id. Check your wallet\u2019s transaction history before retrying — do not release/refund again without confirming.'
      )
    }

    refreshBalance()
    return { txHash: identifier, simulated: false, verified }
  }, [walletAddress, refreshBalance])

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        connecting,
        isAutoConnecting,
        isWalletLocked,
        connectionMode,
        error,
        connect,
        disconnect,
        sendTip,
        assets,
        totalFiat,
        balanceLoading,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>')
  return ctx
}
