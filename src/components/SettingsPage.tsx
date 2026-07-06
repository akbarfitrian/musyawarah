import { useTheme } from '../contexts/ThemeContext'
import { ChevronLeftIcon, MoonIcon, SunIcon } from './icons'

export function SettingsPage({ onBack }: { onBack?: () => void }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div>
      {onBack && (
        <button
          type="button"
          className="mb-4 flex items-center gap-1.5 text-[14px] font-medium text-ink-muted transition-colors hover:text-ink"
          onClick={onBack}
        >
          <ChevronLeftIcon size={16} />
          Back
        </button>
      )}

      <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-card">
        <h1 className="m-0 font-display text-[22px] font-bold text-ink">Settings</h1>
        <p className="mt-1 text-[13px] text-ink-muted">Personalize how Musyawarah looks on this device.</p>

        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-surface-border bg-base px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                isDark ? 'bg-brand-violet/15 text-brand-blue' : 'bg-gold/15 text-gold'
              }`}
            >
              {isDark ? <MoonIcon size={18} /> : <SunIcon size={18} />}
            </span>
            <div>
              <p className="m-0 text-[14px] font-semibold text-ink">Dark mode</p>
              <p className="m-0 text-[13px] text-ink-muted">
                {isDark ? 'On — easier on the eyes at night.' : 'Off — bright, high-contrast theme.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
            className={`group relative h-7 w-[52px] shrink-0 rounded-full p-0.5 shadow-inner transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.97] ${
              isDark
                ? 'bg-brand-gradient'
                : 'bg-surface-hover ring-1 ring-inset ring-surface-border-strong'
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-card transition-transform duration-300 ease-out ${
                isDark ? 'translate-x-[22px]' : 'translate-x-0'
              }`}
            >
              <MoonIcon
                size={12}
                className={`absolute text-brand-violet transition-all duration-200 ${
                  isDark ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                }`}
              />
              <SunIcon
                size={12}
                className={`absolute text-gold transition-all duration-200 ${
                  isDark ? 'scale-50 opacity-0' : 'scale-100 opacity-100'
                }`}
              />
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
