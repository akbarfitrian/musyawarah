
const HUES = [8, 28, 145, 165, 200, 220, 260, 285, 320, 340]

function hashString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function avatarColor(address: string) {
  const hue = HUES[hashString(address) % HUES.length]
  return `hsl(${hue} 46% 42%)`
}

export function avatarInitial(address: string) {
  const cleaned = address.replace(/^0x/i, '').replace(/^@/, '')
  return cleaned.slice(0, 1).toUpperCase()
}

export function resolveAuthorAvatar(
  authorWallet: string,
  fallbackAvatarUrl: string | null | undefined,
  myWalletAddress: string | null | undefined,
  myLiveAvatarUrl: string | null | undefined
): string | null {
  if (myWalletAddress && authorWallet === myWalletAddress) {
    return myLiveAvatarUrl ?? null
  }
  return fallbackAvatarUrl ?? null
}

export function shortenAddress(addr: string) {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
