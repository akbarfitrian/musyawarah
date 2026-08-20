import { useState } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { useProfile } from '../contexts/ProfileContext'

const NAME_MAX_LEN = 50

export function NamePromptModal({ onClose }: { onClose: () => void }) {
  const { updateProfile } = useProfile()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a name to continue.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateProfile({ name: trimmed })
      onClose()
    } catch (e) {
      setError('Failed to save name. Try again.')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-prompt-title"
    >
      <div className="w-full max-w-sm animate-scale-in rounded-2xl border border-surface-border bg-surface-soft p-5 shadow-card">
        <h2 id="name-prompt-title" className="m-0 font-display text-[18px] font-bold text-ink">
          What should we call you?
        </h2>
        <p className="mt-1.5 text-[13px] text-ink-muted">
          A display name is required so people can recognize you beyond your wallet address. You can change it
          again after 30 days.
        </p>

        <input
          type="text"
          className="mt-4 w-full rounded-xl border border-surface-border bg-base px-3 py-2.5 text-[15px] font-medium text-ink placeholder:text-ink-faint placeholder:font-normal focus:border-brand-violet/60 focus:shadow-glow focus:outline-none"
          value={name}
          maxLength={NAME_MAX_LEN}
          placeholder="e.g. Attaza"
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
          }}
        />
        <div className="mt-1 flex justify-end">
          <span className="text-xs tabular-nums text-ink-faint">{NAME_MAX_LEN - name.length}</span>
        </div>

        {error && <p className="mt-1 text-xs text-danger">{error}</p>}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-accent-contrast shadow-glow transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save name'}
          </button>
        </div>
      </div>
    </div>
  )
}
