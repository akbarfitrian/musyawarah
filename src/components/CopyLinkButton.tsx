import { useState } from 'react'
import type { MouseEvent } from 'react'
import { absoluteUrl } from '../utils/routes'
import { CheckIcon, LinkIcon } from './icons'

/** Tombol "copy link" generik -- dipakai di profil, post, dan thread DM
 * biar tiap halaman punya alamat sendiri yang gampang di-share, sama kayak
 * tombol "Copy link to post/profile" di X/Twitter. */
export function CopyLinkButton({
  path,
  label = 'Copy link',
  size = 14,
  className = '',
}: {
  /** Path relatif dari src/utils/routes.ts, mis. profilePath(wallet). */
  path: string
  label?: string
  size?: number
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: MouseEvent) {
    e.stopPropagation()
    const url = absoluteUrl(path)

    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Fallback buat browser/iframe yang nolak Clipboard API (mis. iframe
      // sandbox tanpa "allow-clipboard-write" -- lihat catatan soal Sphere
      // Agent iframe di PostCard.tsx).
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
      } catch (fallbackError) {
        console.error('[MUSYAWARAH] Gagal copy link:', fallbackError)
      }
      document.body.removeChild(textarea)
    }

    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      className={`flex shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-brand-violet/10 hover:text-brand-violet ${className}`}
      onClick={handleCopy}
      aria-label={copied ? 'Link copied' : label}
      title={copied ? 'Link copied!' : label}
    >
      {copied ? <CheckIcon size={size} /> : <LinkIcon size={size} />}
    </button>
  )
}
