import { useNametag } from '../lib/nametags'
import { shortenAddress } from '../utils/avatar'

/**
 * Menampilkan Unicity ID ("@alice") untuk sebuah wallet_address (chainPubkey).
 * Kalau wallet itu belum punya nametag, jatuh ke alamat yang dipendekkan.
 */
export function WalletHandle({ wallet }: { wallet: string }) {
  const nametag = useNametag(wallet)
  return <>{nametag ? `@${nametag}` : shortenAddress(wallet)}</>
}

/** Versi string untuk aria-label / atribut yang tidak bisa pakai komponen. */
export function useHandleLabel(wallet: string): string {
  const nametag = useNametag(wallet)
  return nametag ? `@${nametag}` : shortenAddress(wallet)
}
