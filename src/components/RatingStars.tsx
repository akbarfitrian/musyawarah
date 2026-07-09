import { StarIcon } from './icons'

/** Baris 5 bintang. Display-only (`onChange` kosong) atau interaktif buat
 * form review -- dipakai bareng di ProfilePage & OrderUpdateChip (Fase 4). */
export function RatingStars({
  value,
  onChange,
  size = 14,
}: {
  value: number
  onChange?: (rating: number) => void
  size?: number
}) {
  const interactive = Boolean(onChange)
  return (
    <span className="inline-flex items-center gap-0.5 text-gold">
      {[1, 2, 3, 4, 5].map((n) =>
        interactive ? (
          <button
            key={n}
            type="button"
            className="transition-transform hover:scale-110"
            onClick={() => onChange!(n)}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
          >
            <StarIcon size={size} filled={n <= value} />
          </button>
        ) : (
          <StarIcon key={n} size={size} filled={n <= Math.round(value)} />
        )
      )}
    </span>
  )
}
