// ============================================================================
// DISMISS "Leave a review" PROMPT — preferensi ringan per (wallet, order),
// disimpan di localStorage, sama polanya kayak ThemeContext.tsx (preferensi
// tampilan doang, BUKAN data transaksi -- order-nya sendiri tetap 'released'
// & tetap bisa direview kapan pun lewat tombol "Rate now", ini cuma nyimpen
// "form-nya udah pernah aku sembunyiin di device ini").
//
// SENGAJA client-side (bukan kolom/tabel baru di Supabase): beda dari
// alreadyReviewed (baca dari tabel `reviews`, sumber kebenarannya di server,
// harus konsisten lintas device), "dismiss" itu preferensi UI doang -- kalau
// user buka di device lain, form-nya boleh aja nongol lagi, itu bukan bug.
// ============================================================================

const STORAGE_KEY = 'musyawarah:dismissedReviewPrompts'

function keyFor(walletAddress: string, orderId: string) {
  return `${walletAddress}:${orderId}`
}

function readAll(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function writeAll(all: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...all]))
  } catch {
    // localStorage penuh/disabled -- gagal senyap, cuma berarti form-nya
    // nongol lagi abis reload, bukan error yang perlu diributin ke user.
  }
}

export function isReviewPromptDismissed(walletAddress: string | null, orderId: string): boolean {
  if (!walletAddress) return false
  return readAll().has(keyFor(walletAddress, orderId))
}

/** Dipanggil pas user klik "Not now" di form rating -- form ilang dari
 * thread ini (di device ini) sampai dia klik "Rate now" lagi. */
export function dismissReviewPrompt(walletAddress: string, orderId: string) {
  const all = readAll()
  all.add(keyFor(walletAddress, orderId))
  writeAll(all)
}

/** Dipanggil pas user klik "Rate now" buat manggil balik form yang tadi
 * di-dismiss. */
export function undismissReviewPrompt(walletAddress: string, orderId: string) {
  const all = readAll()
  all.delete(keyFor(walletAddress, orderId))
  writeAll(all)
}
