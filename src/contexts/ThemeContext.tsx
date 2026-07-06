import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

// ============================================================================
// THEME STATE — light / dark, satu sumber dipakai di seluruh app
// ----------------------------------------------------------------------------
// Preferensi disimpan di localStorage biar kepilih lagi pas reload. Kalau
// belum pernah diset, kita ikutin preferensi sistem (prefers-color-scheme).
// Class `dark` ditempel/dilepas di <html> — semua warna semantik (base,
// surface, ink, dst di tailwind.config.js) baca CSS variable yang di-swap
// lewat selector `.dark` di index.css, jadi seluruh UI ikut berubah tanpa
// perlu variant `dark:` di tiap komponen.
// ============================================================================

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'musyawarah:theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => setThemeState(next), [])
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    []
  )

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme harus dipakai di dalam <ThemeProvider>')
  return ctx
}
