import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import { HeartIcon } from './icons'

export function LikeButton({
  postId,
  likeTotal,
  likedByMe,
  onLiked,
}: {
  postId: string
  likeTotal: number
  likedByMe: boolean
  onLiked: () => void
}) {
  const { walletAddress } = useWallet()
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  async function handleClick() {
    if (busy) return
    if (!walletAddress) {
      setHint('Connect your wallet first to like')
      setTimeout(() => setHint(null), 2000)
      return
    }

    setBusy(true)
    try {
      const { error } = await supabase.rpc('toggle_like', {
        p_wallet: walletAddress,
        p_post_id: postId,
      })

      if (error) throw error
      onLiked()
    } catch (e) {
      setHint('Failed to like. Try again.')
      setTimeout(() => setHint(null), 2000)
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        className={`flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-medium transition-colors ${
          likedByMe
            ? 'text-danger hover:bg-danger/10'
            : !walletAddress
              ? 'cursor-not-allowed text-ink-faint'
              : 'text-ink-muted hover:bg-danger/10 hover:text-danger'
        }`}
        onClick={handleClick}
        disabled={busy}
        aria-pressed={likedByMe}
        aria-label={likedByMe ? 'Unlike' : 'Like'}
        title={likedByMe ? 'Unlike' : 'Like'}
      >
        <span className="flex">
          <HeartIcon size={17} filled={likedByMe} />
        </span>
        {likeTotal > 0 && <span className="tabular-nums">{likeTotal}</span>}
      </button>

      {hint && (
        <div className="absolute bottom-full left-0 z-20 mb-2 whitespace-nowrap rounded-lg border border-surface-border bg-surface-soft px-3 py-1.5 text-xs font-medium text-ink shadow-card animate-fade-in">
          {hint}
        </div>
      )}
    </div>
  )
}
