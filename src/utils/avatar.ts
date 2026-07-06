// Avatar sederhana: warna & inisial diturunkan deterministik dari wallet address,
// jadi tiap wallet selalu dapet warna yang sama tanpa perlu upload gambar.

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
  // skip prefix umum kayak "0x" (alamat mentah) atau "@" (nametag Sphere)
  // biar inisialnya lebih variatif dan nggak keliatan "@" doang
  const cleaned = address.replace(/^0x/i, '').replace(/^@/, '')
  return cleaned.slice(0, 1).toUpperCase()
}

/**
 * Avatar buat post/entry manapun yang authornya wallet KITA SENDIRI harus
 * selalu ambil dari ProfileContext yang live (real-time keupdate tiap avatar
 * diganti), BUKAN dari field yang nempel di post/entry (author_avatar_url)
 * yang cuma snapshot pas data itu di-fetch. Ini jaga-jaga: walau ada tempat
 * yang lupa manggil refresh() abis ganti avatar, avatar kita tetep bener di
 * mana-mana karena nggak pernah pakai data basi punya wallet sendiri.
 */
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
