import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import { CoinIcon } from './icons'

export function TipButton({
  postId,
  toWallet,
  tipTotal,
  onTipped,
}: {
  postId: string
  toWallet: string
  tipTotal: number
  onTipped: () => void
}) {
  const { walletAddress, sendTip } = useWallet()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('1')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const isOwnPost = walletAddress === toWallet
  const disabled = !walletAddress || isOwnPost

  function handleIconClick() {
    if (!walletAddress) {
      setHint('Connect your wallet first to send a tip')
      setTimeout(() => setHint(null), 2000)
      return
    }
    if (isOwnPost) {
      setHint('You can’t tip your own post')
      setTimeout(() => setHint(null), 2000)
      return
    }
    setOpen((v) => !v)
  }

  async function handleConfirm() {
    if (!walletAddress) return
    const value = parseFloat(amount)
    if (!value || value <= 0) {
      setError('Amount must be greater than 0')
      return
    }

    setSending(true)
    setError(null)
    try {
      const { txHash, simulated } = await sendTip(toWallet, value)

      const { error: tipError } = await supabase.rpc('send_tip', {
        p_from: walletAddress,
        p_to: toWallet,
        p_post_id: postId,
        p_amount: value,
        p_tx_hash: txHash,
      })
      if (tipError) throw tipError

      if (simulated) {
        console.info('[MUSYAWARAH] Tip disimulasikan (belum transfer on-chain beneran).')
      }

      setOpen(false)
      setAmount('1')
      onTipped()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to send tip. Try again.'
      setError(message)
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="relative">
      <button
        className={`flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-medium transition-colors ${
          disabled
            ? 'cursor-not-allowed text-ink-faint'
            : 'text-ink-muted hover:bg-gold/10 hover:text-gold'
        }`}
        onClick={handleIconClick}
        aria-label="Tip"
      >
        <span className="flex">
          <CoinIcon />
        </span>
        {tipTotal > 0 && <span className="tabular-nums">{tipTotal}</span>}
      </button>

      {hint && (
        <div className="absolute bottom-full left-0 z-20 mb-2 whitespace-nowrap rounded-lg border border-surface-border bg-surface-soft px-3 py-1.5 text-xs font-medium text-ink shadow-card animate-fade-in">
          {hint}
        </div>
      )}

      {open && (
        <div
          className="absolute bottom-full left-0 z-30 mb-2 w-56 animate-scale-in rounded-2xl border border-surface-border bg-surface-soft p-3.5 shadow-card"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[13px] font-semibold text-ink">Send tip</span>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-surface-border bg-base px-3 py-2 focus-within:border-gold/60 focus-within:shadow-[0_0_0_1px_rgba(217,119,6,0.4)]">
            <input
              type="number"
              min="0"
              step="0.1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              className="w-full bg-transparent text-[15px] font-mono text-ink outline-none"
            />
            <span className="shrink-0 text-xs font-medium text-ink-muted">UCT</span>
          </div>
          {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-hover"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-gradient-to-r from-gold to-amber-400 px-3.5 py-1.5 text-[13px] font-semibold text-base transition-transform duration-150 hover:scale-[1.03] active:scale-95 disabled:opacity-60"
              onClick={handleConfirm}
              disabled={sending}
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
