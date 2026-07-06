import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import { RepostIcon } from './icons'

export function RepostButton({
  postId,
  postAuthorWallet,
  isOwnPost,
  repostTotal,
  repostedByMe,
  onReposted,
}: {
  postId: string
  /** Wallet penulis post asli -- penerima notifikasi repost. */
  postAuthorWallet: string
  isOwnPost: boolean
  repostTotal: number
  repostedByMe: boolean
  onReposted: () => void
}) {
  const { walletAddress } = useWallet()
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  function showHint(message: string) {
    setHint(message)
    setTimeout(() => setHint(null), 2000)
  }

  async function handleClick() {
    if (busy) return
    if (!walletAddress) {
      showHint('Connect your wallet first to repost')
      return
    }
    if (isOwnPost) {
      showHint('You can’t repost your own post')
      return
    }

    setBusy(true)
    try {
      // toggle_repost() di server (supabase/002_harden_writes.sql) yang
      // nge-cek post-nya beneran ada, "gak bisa repost post sendiri", dan
      // bikin/hapus notifikasinya sekalian, atomik dalam satu function call.
      const { error } = await supabase.rpc('toggle_repost', {
        p_wallet: walletAddress,
        p_post_id: postId,
      })

      if (error) throw error
      onReposted()
    } catch (e) {
      showHint('Failed to repost. Try again.')
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  const disabled = !walletAddress || isOwnPost

  return (
    <div className="relative">
      <button
        className={`flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-medium transition-colors ${
          repostedByMe
            ? 'text-brand-cyan hover:bg-brand-cyan/10'
            : disabled
              ? 'cursor-not-allowed text-ink-faint'
              : 'text-ink-muted hover:bg-brand-cyan/10 hover:text-brand-cyan'
        }`}
        onClick={handleClick}
        disabled={busy}
        aria-pressed={repostedByMe}
        aria-label={repostedByMe ? 'Undo repost' : 'Repost'}
        title={repostedByMe ? 'Undo repost' : 'Repost'}
      >
        <span className="flex">
          <RepostIcon />
        </span>
        {repostTotal > 0 && <span className="tabular-nums">{repostTotal}</span>}
      </button>

      {hint && (
        <div className="absolute bottom-full left-0 z-20 mb-2 whitespace-nowrap rounded-lg border border-surface-border bg-surface-soft px-3 py-1.5 text-xs font-medium text-ink shadow-card animate-fade-in">
          {hint}
        </div>
      )}
    </div>
  )
}
