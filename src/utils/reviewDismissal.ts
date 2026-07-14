
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
  }
}

export function isReviewPromptDismissed(walletAddress: string | null, orderId: string): boolean {
  if (!walletAddress) return false
  return readAll().has(keyFor(walletAddress, orderId))
}

export function dismissReviewPrompt(walletAddress: string, orderId: string) {
  const all = readAll()
  all.add(keyFor(walletAddress, orderId))
  writeAll(all)
}

export function undismissReviewPrompt(walletAddress: string, orderId: string) {
  const all = readAll()
  all.delete(keyFor(walletAddress, orderId))
  writeAll(all)
}
