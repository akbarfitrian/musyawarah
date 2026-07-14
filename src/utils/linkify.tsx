import type { ReactNode } from 'react'

const URL_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi

function trimTrailingPunctuation(url: string): { url: string; trailing: string } {
  const match = url.match(/^(.*?)([.,!?;:)\]}]+)$/)
  if (!match) return { url, trailing: '' }
  return { url: match[1], trailing: match[2] }
}

export function linkify(text: string): ReactNode[] {
  const parts = text.split(URL_PATTERN)

  return parts.map((part, i) => {
    const isUrl = i % 2 === 1
    if (!isUrl || !part) return part

    const { url, trailing } = trimTrailingPunctuation(part)
    const href = url.startsWith('www.') ? `https://${url}` : url

    return (
      <span key={i}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline decoration-current/40 underline-offset-2 font-medium hover:decoration-current"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
        {trailing}
      </span>
    )
  })
}
