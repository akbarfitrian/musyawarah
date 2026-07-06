import { useEffect, useRef, useState } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { useConversations, useThread } from '../hooks/useMessages'
import { useViewedProfile } from '../hooks/useViewedProfile'
import { avatarColor, avatarInitial, shortenAddress } from '../utils/avatar'
import { timeAgo } from '../utils/time'
import { ChevronLeftIcon, ComposeMessageIcon, MessageIcon, SendIcon, XIcon } from './icons'

function ConversationRow({
  wallet,
  avatarUrl,
  preview,
  timestamp,
  unread,
  onClick,
  onVisitProfile,
}: {
  wallet: string
  avatarUrl: string | null
  preview: string
  timestamp: string
  unread: number
  onClick: () => void
  onVisitProfile?: (walletAddress: string) => void
}) {
  // Div (bukan <button>) buat baris ini, soalnya avatar & username di
  // dalamnya juga butuh jadi elemen interaktif sendiri (buka profil) --
  // <button> nggak boleh nested di dalam <button> lain.
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex w-full cursor-pointer items-center gap-3 border-b border-surface-border px-4 py-3 text-left transition-colors hover:bg-surface/60"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <button
        type="button"
        className="h-11 w-11 shrink-0 overflow-hidden rounded-full text-sm font-semibold text-white transition-transform duration-150 hover:scale-105"
        style={{ background: avatarColor(wallet) }}
        onClick={(e) => {
          e.stopPropagation()
          onVisitProfile?.(wallet)
        }}
        aria-label={`View profile ${shortenAddress(wallet)}`}
      >
        <span className="flex h-full w-full items-center justify-center">
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : avatarInitial(wallet)}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={`truncate font-mono text-[14px] text-ink hover:underline ${unread > 0 ? 'font-bold' : 'font-semibold'}`}
            onClick={(e) => {
              e.stopPropagation()
              onVisitProfile?.(wallet)
            }}
          >
            {shortenAddress(wallet)}
          </button>
          <span className="text-ink-faint">·</span>
          <span className="shrink-0 text-[12px] text-ink-muted">{timeAgo(timestamp)}</span>
        </div>
        <p className={`truncate text-[13px] ${unread > 0 ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
          {preview}
        </p>
      </div>
      {unread > 0 && (
        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-notify px-1.5 text-[11px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </div>
  )
}

function NewMessageForm({ onStart, onCancel }: { onStart: (wallet: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('')

  return (
    <div className="border-b border-surface-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-ink">New message</span>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
          onClick={onCancel}
          aria-label="Cancel"
        >
          <XIcon size={14} />
        </button>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Wallet address or @handle"
          className="w-full rounded-full border border-surface-border bg-base px-4 py-2 font-mono text-[13px] text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-brand-violet/60 focus:shadow-glow focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onStart(value.trim())
          }}
          autoFocus
        />
        <button
          type="button"
          className="shrink-0 rounded-full bg-brand-gradient px-4 py-2 text-[13px] font-semibold text-accent-contrast shadow-glow transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
          disabled={!value.trim()}
          onClick={() => onStart(value.trim())}
        >
          Chat
        </button>
      </div>
    </div>
  )
}

function ThreadView({
  otherWallet,
  onBack,
  onVisitProfile,
}: {
  otherWallet: string
  onBack: () => void
  onVisitProfile?: (walletAddress: string) => void
}) {
  const { walletAddress: myWallet } = useWallet()
  const { messages, loading, error, sending, sendMessage } = useThread(otherWallet)
  const { profile: otherProfile } = useViewedProfile(otherWallet)
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  async function handleSend() {
    const trimmed = draft.trim()
    if (!trimmed || sending) return
    setDraft('')
    try {
      await sendMessage(trimmed)
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal ngirim pesan:', e)
      setDraft(trimmed) // balikin draft-nya biar nggak ilang kalau gagal kirim
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          onClick={onBack}
          aria-label="Back to messages"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <button
          type="button"
          className="h-9 w-9 shrink-0 overflow-hidden rounded-full text-xs font-semibold text-white transition-transform duration-150 hover:scale-105"
          style={{ background: avatarColor(otherWallet) }}
          onClick={() => onVisitProfile?.(otherWallet)}
          aria-label={`View profile ${shortenAddress(otherWallet)}`}
        >
          <span className="flex h-full w-full items-center justify-center">
            {otherProfile?.avatar_url ? (
              <img src={otherProfile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              avatarInitial(otherWallet)
            )}
          </span>
        </button>
        <button
          type="button"
          className="truncate font-mono text-[15px] font-semibold text-ink hover:underline"
          onClick={() => onVisitProfile?.(otherWallet)}
        >
          {shortenAddress(otherWallet)}
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="py-8 text-center text-[13px] text-ink-muted">Loading conversation…</p>
        ) : error ? (
          <p className="py-8 text-center text-[13px] text-danger">{error}</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-muted">
            No messages yet. Say hi to {shortenAddress(otherWallet)}.
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_wallet === myWallet
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${
                    isMine
                      ? 'rounded-br-md bg-brand-gradient text-accent-contrast'
                      : 'rounded-bl-md border border-surface-border bg-surface text-ink'
                  }`}
                >
                  {m.content}
                  <span className={`ml-2 text-[10px] ${isMine ? 'text-accent-contrast/70' : 'text-ink-faint'}`}>
                    {timeAgo(m.created_at)}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-surface-border p-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          maxLength={1000}
          className="w-full rounded-full border border-surface-border bg-base px-4 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-brand-violet/60 focus:shadow-glow focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
        />
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-accent-contrast shadow-glow transition-transform hover:scale-[1.05] active:scale-95 disabled:opacity-50"
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          aria-label="Send message"
        >
          <SendIcon size={16} />
        </button>
      </div>
    </div>
  )
}

export function MessagesPage({
  openWallet,
  onConsumeOpenWallet,
  onVisitProfile,
}: {
  /** Kalau diisi (mis. dari tombol "Message" di profil orang), langsung
   * buka thread ke wallet ini pas halaman ke-mount. */
  openWallet?: string | null
  onConsumeOpenWallet?: () => void
  /** Dipanggil pas avatar/username di daftar pesan atau di header chat diklik. */
  onVisitProfile?: (walletAddress: string) => void
}) {
  const { walletAddress: myWallet, isAutoConnecting, connecting, connect } = useWallet()
  const { conversations, loading, error, refresh } = useConversations()
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)
  const [showNewMessage, setShowNewMessage] = useState(false)

  useEffect(() => {
    if (openWallet) {
      setSelectedWallet(openWallet)
      onConsumeOpenWallet?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWallet])

  function openThread(wallet: string) {
    setShowNewMessage(false)
    setSelectedWallet(wallet)
  }

  function backToList() {
    setSelectedWallet(null)
    refresh()
  }

  if (isAutoConnecting) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-ink-muted">Checking wallet…</p>
      </div>
    )
  }

  if (!myWallet) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-ink-muted">Connect your wallet to see your messages.</p>
        <button
          className="rounded-full bg-brand-gradient px-6 py-2.5 text-[15px] font-semibold text-accent-contrast shadow-glow transition-transform duration-150 hover:scale-[1.03] active:scale-95 disabled:opacity-60"
          onClick={connect}
          disabled={connecting}
        >
          {connecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
      </div>
    )
  }

  if (selectedWallet) {
    return (
      <div className="h-[calc(100vh-56px)] md:h-[calc(100vh-57px)]">
        <ThreadView otherWallet={selectedWallet} onBack={backToList} onVisitProfile={onVisitProfile} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[13px] font-medium text-ink-faint">
          {conversations.length === 0 ? 'No conversations yet' : `${conversations.length} conversation${conversations.length === 1 ? '' : 's'}`}
        </span>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-brand-violet transition-colors hover:bg-brand-violet/10"
          onClick={() => setShowNewMessage((v) => !v)}
          aria-label="New message"
          title="New message"
        >
          <ComposeMessageIcon size={19} />
        </button>
      </div>

      {showNewMessage && (
        <NewMessageForm onStart={openThread} onCancel={() => setShowNewMessage(false)} />
      )}

      {loading ? (
        <p className="py-16 text-center text-[13px] text-ink-muted">Loading messages…</p>
      ) : error ? (
        <p className="py-16 text-center text-[13px] text-danger">{error}</p>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-ink-faint">
            <MessageIcon size={26} />
          </div>
          <p className="max-w-[240px] text-[13px] text-ink-muted">
            No messages yet. Start a conversation with any wallet address.
          </p>
        </div>
      ) : (
        conversations.map((c) => (
          <ConversationRow
            key={c.wallet_address}
            wallet={c.wallet_address}
            avatarUrl={c.avatar_url}
            preview={c.last_message.sender_wallet === myWallet ? `You: ${c.last_message.content}` : c.last_message.content}
            timestamp={c.last_message.created_at}
            unread={c.unread_count}
            onClick={() => openThread(c.wallet_address)}
            onVisitProfile={onVisitProfile}
          />
        ))
      )}
    </div>
  )
}
