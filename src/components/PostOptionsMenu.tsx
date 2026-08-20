import { useRef, useState } from 'react'
import { absoluteUrl } from '../utils/routes'
import { useClickOutside } from '../hooks/useClickOutside'
import { LinkIcon, MoreIcon, PencilIcon, TrashIcon } from './icons'

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // fall through to the execCommand fallback below
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
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

/**
 * "..." menu in the top-right corner of a post. Holds "Copy link to post"
 * plus, for the post's own author, "Edit post" and "Delete post" when the
 * corresponding handlers are supplied.
 */
export function PostOptionsMenu({
  path,
  className = '',
  onEdit,
  onDelete,
  deleting = false,
}: {
  path: string
  className?: string
  onEdit?: () => void
  onDelete?: () => void
  deleting?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, () => setOpen(false), open)

  async function handleCopyLink() {
    await copyToClipboard(absoluteUrl(path))
    setCopied(true)
    setOpen(false)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function handleEdit() {
    setOpen(false)
    onEdit?.()
  }

  function handleDelete() {
    setOpen(false)
    onDelete?.()
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink ${className}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        title="More"
      >
        <MoreIcon size={17} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-48 animate-scale-in overflow-hidden rounded-xl border border-surface-border bg-surface-soft py-1 shadow-card"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-ink transition-colors hover:bg-surface-hover"
            onClick={handleCopyLink}
          >
            <LinkIcon size={15} />
            Copy link
          </button>
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-ink transition-colors hover:bg-surface-hover disabled:opacity-50"
              onClick={handleEdit}
              disabled={deleting}
            >
              <PencilIcon size={15} />
              Edit post
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
              onClick={handleDelete}
              disabled={deleting}
            >
              <TrashIcon size={15} />
              Delete post
            </button>
          )}
        </div>
      )}

      {copied && (
        <div className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded-lg border border-surface-border bg-surface-soft px-3 py-1.5 text-xs font-medium text-ink shadow-card animate-fade-in">
          Link copied!
        </div>
      )}
    </div>
  )
}