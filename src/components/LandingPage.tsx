import { useEffect, useRef, useState } from 'react'
import { LogoMark } from './icons'

const SLIDES = [
  {
    headline: 'The Next Era of Social Connection.',
    sub: 'Connect, build your reputation, and experience true Web3 freedom built on Unicity Labs.',
  },
  {
    headline: 'Reward Value, Instantly.',
    sub: 'Support your favorite creators directly on-chain with frictionless, instant micro-tipping.',
  },
  {
    headline: 'Monetize Your AI Capabilities.',
    sub: 'List, discover, and trade specialized AI Agent skills in a decentralized marketplace.',
  },
]

const SLIDE_INTERVAL_MS = 5000

export function LandingPage({ onLaunch }: { onLaunch: () => void }) {
  const [active, setActive] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => setActive((i) => (i + 1) % SLIDES.length), SLIDE_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function goToSlide(index: number) {
    setActive(index)
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => setActive((i) => (i + 1) % SLIDES.length), SLIDE_INTERVAL_MS)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6">
      <div className="grid w-full max-w-[880px] grid-cols-1 overflow-hidden rounded-[20px] border border-white/10 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] sm:grid-cols-[1.1fr_1fr]">
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-[22px] bg-black px-10 py-14 text-center sm:min-h-[480px]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-black">
              <LogoMark size={40} />
            </div>
            <span className="font-display text-[clamp(1.9rem,4vw,2.4rem)] font-semibold text-white">Musyawarah</span>
          </div>

          <div className="relative min-h-[104px] w-full max-w-[34ch] sm:min-h-[120px]">
            {SLIDES.map((slide, i) => (
              <div
                key={slide.headline}
                aria-hidden={i !== active}
                className={`absolute inset-0 flex flex-col items-center justify-center gap-2 transition-all duration-[400ms] ease-out ${
                  i === active ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'
                }`}
              >
                <p className="m-0 font-display text-[19px] font-semibold leading-snug text-white sm:text-[21px]">
                  {slide.headline}
                </p>
                <p className="m-0 text-[13.5px] leading-relaxed text-ink-muted">{slide.sub}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-1.5">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.headline}
                type="button"
                onClick={() => goToSlide(i)}
                aria-label={`Ke slide ${i + 1}`}
                aria-current={i === active}
                className={`h-1 w-[26px] rounded-full transition-colors ${i === active ? 'bg-gold' : 'bg-white/15'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 bg-white px-10 py-14 text-center">
          <p className="m-0 text-[13px] text-black">Your wallet is your profile.</p>
          <button
            type="button"
            onClick={onLaunch}
            className="w-full max-w-[260px] rounded-full bg-black px-[22px] py-3.5 text-[15px] font-bold text-white transition-transform duration-150 hover:bg-[#1a1a1a] active:scale-[0.97]"
          >
            Launch App
          </button>
          <p className="m-0 text-[12.5px] text-black">No sign-up · No email · Just your wallet</p>
        </div>
      </div>
    </div>
  )
}