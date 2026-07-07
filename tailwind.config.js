/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Pure black + white theme, light and dark. Values read from CSS
        // variables defined in index.css (`:root` for light, `.dark` for
        // dark) so every component gets both themes for free.
        base: {
          DEFAULT: 'rgb(var(--color-base) / <alpha-value>)',
          soft: 'rgb(var(--color-base-soft) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          soft: 'rgb(var(--color-surface-soft) / <alpha-value>)',
          hover: 'rgb(var(--color-surface-hover) / <alpha-value>)',
          border: 'var(--color-surface-border)',
          borderStrong: 'var(--color-surface-border-strong)',
        },
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          muted: 'rgb(var(--color-ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--color-ink-faint) / <alpha-value>)',
        },
        // Monochrome accent — CTAs, active nav, links, focus rings. Black
        // on white in light mode, white on black in dark mode. `brand.*`
        // is kept as an alias so existing bg-brand-gradient/text-brand-*
        // classes throughout the app stay monochrome automatically.
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          contrast: 'rgb(var(--color-accent-contrast) / <alpha-value>)',
        },
        brand: {
          violet: 'rgb(var(--color-accent) / <alpha-value>)',
          violetSoft: 'rgb(var(--color-accent) / <alpha-value>)',
          blue: 'rgb(var(--color-accent) / <alpha-value>)',
          cyan: 'rgb(var(--color-accent) / <alpha-value>)',
        },
        // Fixed, theme-independent blue — reserved for unread-message
        // notification badges/dots ONLY. Everything else in the UI is
        // monochrome; this is the one intentional splash of color.
        notify: '#2563EB',
        gold: '#D97706', // tipping — stays distinct as a tier/money color
        danger: '#DC2626',
      },
      fontFamily: {
        // Fraunces: a warm, slightly wonky serif for the wordmark and
        // section headings — gives the "sitting down to deliberate" warmth
        // a neutral grotesk can't. Used sparingly via `font-display`.
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        // Plus Jakarta Sans: designed for the city of Jakarta — a deliberate
        // nod to where "musyawarah" comes from, and a cleaner read than the
        // generic system-font fallback this UI shipped with before.
        sans: [
          '"Plus Jakarta Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--color-accent) / 0.3), 0 4px 16px -4px rgb(var(--color-accent) / 0.3)',
        glowCyan: '0 0 0 1px rgb(var(--color-accent) / 0.3), 0 4px 16px -4px rgb(var(--color-accent) / 0.3)',
        card: '0 1px 0 0 var(--shadow-card-highlight) inset, 0 2px 10px -4px var(--shadow-card-1), 0 1px 2px var(--shadow-card-2)',
      },
      backgroundImage: {
        // Flat monochrome fill (kept as a "gradient" token so existing
        // bg-brand-gradient classes across the app don't need renaming —
        // it just resolves to solid black in light mode / solid white in
        // dark mode).
        'brand-gradient': 'linear-gradient(135deg, rgb(var(--color-accent)) 0%, rgb(var(--color-accent)) 100%)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Dipakai buat nyorotin post yang dituju abis diklik dari
        // "Trending" di RightPanel.tsx -- ring-nya keliatan sekilas terus
        // meluruh, bukan nempel permanen.
        'highlight-flash': {
          '0%': { backgroundColor: 'rgb(var(--color-accent) / 0.12)' },
          '100%': { backgroundColor: 'rgb(var(--color-accent) / 0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        'scale-in': 'scale-in 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        'highlight-flash': 'highlight-flash 2.4s ease-out forwards',
      },
    },
  },
  plugins: [],
}
