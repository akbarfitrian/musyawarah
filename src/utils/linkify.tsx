import type { ReactNode } from 'react'

// ============================================================================
// LINKIFY — ubah URL polos di dalam teks (post content, bio profil) jadi
// link yang bisa diklik & kebuka di tab baru. Dipakai bareng di PostCard &
// ProfilePage biar link nggak cuma teks mati.
// ============================================================================

// Nangkep http(s):// dan www. -- sengaja nggak nangkep bare domain kayak
// "google.com" tanpa prefix, biar nggak salah nge-link kata biasa yang
// kebetulan ada titiknya (mis. "v1.2.3" atau "sorry.").
const URL_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi

/** Trailing punctuation kayak titik/koma/kurung tutup sering ketarik ikutan match -- lepas lagi biar link-nya bersih. */
function trimTrailingPunctuation(url: string): { url: string; trailing: string } {
  const match = url.match(/^(.*?)([.,!?;:)\]}]+)$/)
  if (!match) return { url, trailing: '' }
  return { url: match[1], trailing: match[2] }
}

/**
 * Pecah teks jadi array node React: string biasa & <a> buat tiap URL yang
 * kedeteksi. Aman dari XSS -- ini bukan dangerouslySetInnerHTML, semua teks
 * tetep lewat React text node biasa.
 */
export function linkify(text: string): ReactNode[] {
  // String.split() dengan regex yang punya 1 capturing group bakal nyelipin
  // hasil match ke array balikannya, jadi hasilnya selang-seling:
  // [teks, url, teks, url, ...] -- index genap = teks biasa, index ganjil = URL.
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
          // `currentColor` on purpose, bukan warna tetap: link ini bisa
          // muncul di atas bubble dengan bg accent (chat "isMine", lihat
          // MessagesPage) yang membalik ink jadi accent-contrast. Warna
          // tetap kayak text-brand-violet bakal SAMA PERSIS sama bg bubble
          // itu (accent == accent, karena tema ini monokrom) jadi link-nya
          // ilang. Pakai currentColor + underline tebal biar link selalu
          // ketauan sebagai link tanpa pernah nyatu sama background-nya.
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
