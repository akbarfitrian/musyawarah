import { useEffect, type RefObject } from 'react'

/**
 * Menutup elemen (mis. dropdown/menu profil) saat pengguna klik di luar area
 * yang direferensikan oleh `ref`, atau saat menekan tombol Escape.
 *
 * @param ref     Ref ke elemen container dropdown/menu.
 * @param onOutsideClick  Callback yang dipanggil saat klik di luar terdeteksi.
 * @param enabled Set `false` untuk menonaktifkan listener saat menu sedang tertutup.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutsideClick: () => void,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const el = ref.current
      if (!el) return
      const target = event.target as Node
      if (!el.contains(target)) {
        onOutsideClick()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOutsideClick()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, enabled])
}
