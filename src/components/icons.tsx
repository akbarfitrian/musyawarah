
interface IconProps {
  size?: number
  filled?: boolean
  className?: string
}

export function HomeIcon({ size = 24, filled = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 11.5 12 4l8 7.5M6 10v9h5v-5.5h2V19h5v-9"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 2}
        fill={filled ? 'currentColor' : 'none'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CoinIcon({ size = 19 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7.5v9M9.7 9.6c0-1 1-1.8 2.3-1.8s2.3.7 2.3 1.6c0 2.2-4.6 1-4.6 3.2 0 .9 1 1.6 2.3 1.6s2.3-.7 2.3-1.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SearchIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function FeatherIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M20 4c-6 0-12 3-14 11-.3 1.1.4 2 1.5 2 8-2 11-8 11-13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 18l4.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ChevronDownIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 8l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ImageIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M21 15l-5-5-9 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function XIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function ChevronLeftIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LogoutIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M9 4H5v16h4M15 8l4 4-4 4M9 12h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function FlameIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2c1 3-2 4-2 7a4 4 0 108 0c0-1-.5-2-1-2.5.3 2-1 3-1 3 .5-4-2-4.5-2-7.5-1 1-2 2-2 4.5-1.3-1-1-3.5 0-4.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UserIcon({ size = 24, filled = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="8"
        r="4"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 2}
        fill={filled ? 'currentColor' : 'none'}
      />
      <path
        d="M4 20c1.2-4 4.4-6 8-6s6.8 2 8 6"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 2}
        fill={filled ? 'currentColor' : 'none'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CameraIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="3.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function PencilIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20l1-4L16 5l3 3L8 19l-4 1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function RepostIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M6 4.5v9a2 2 0 002 2h9M17 12l3 3.5-3 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 19.5v-9a2 2 0 00-2-2H7M7 12l-3-3.5L7 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function GifIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="sans-serif">
        GIF
      </text>
    </svg>
  )
}

export function PollIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3a9 9 0 010 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ListIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1.4" fill="currentColor" />
      <circle cx="4" cy="12" r="1.4" fill="currentColor" />
      <circle cx="4" cy="18" r="1.4" fill="currentColor" />
    </svg>
  )
}

export function EmojiIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="10" r="1.1" fill="currentColor" />
      <circle cx="15" cy="10" r="1.1" fill="currentColor" />
      <path d="M8 14.5c1 1.3 2.4 2 4 2s3-.7 4-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ScheduleIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 9.5h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 13v3l2 1.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LocationIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21s7-6.2 7-11.5A7 7 0 105 9.5C5 14.8 12 21 12 21z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.5" r="2.3" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function FlagIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 4h11l-2.5 3.5L16 11H5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function LogoMark({ size = 22 }: IconProps) {
  // Brand mark — uploaded architectural "M" logo. Solid black artwork;
  // inverted to solid white in dark mode via `dark:invert` so it always
  // reads against its badge (see Sidebar/App usage: white badge in light
  // mode, black badge in dark mode).
  return (
    <img
      src="/logo.png"
      alt="MUSYAWARAH"
      width={size}
      height={size}
      className="dark:invert"
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
    />
  )
}

export function TrashIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0 1 12a1 1 0 001 1h6a1 1 0 001-1l1-12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SendIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 12.5 20 4l-6.5 16-2.4-7.1L4 12.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function BellIcon({ size = 22, filled = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M6 10.5a6 6 0 1112 0c0 3.3.9 5.2 2 6.5H4c1.1-1.3 2-3.2 2-6.5z"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 2}
        fill={filled ? 'currentColor' : 'none'}
        strokeLinejoin="round"
      />
      <path
        d="M9.5 19.5a2.5 2.5 0 005 0"
        stroke="currentColor"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MessageIcon({ size = 20, filled = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5.5h16a1 1 0 011 1v9a1 1 0 01-1 1H9l-4.5 3.5V16.5H4a1 1 0 01-1-1v-9a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 2}
        fill={filled ? 'currentColor' : 'none'}
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ComposeMessageIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5.5h11a1 1 0 011 1v7a1 1 0 01-1 1H9l-4.5 3.5V14.5H4a1 1 0 01-1-1v-7a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M17 3.5v6M14 6.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function UserPlusIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="9.5" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3 20c1-3.5 3.6-5.3 6.5-5.3S15 16.5 16 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M19 8v6M16 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Badge centang bergerigi (kayak centang biru/emas Twitter) -- warna
 * dikontrol dari luar lewat `currentColor` (fill), dipakai buat tier
 * "verified" (biru) & "verified_pro" (emas). Lihat VerifiedBadge.tsx. */
export function VerifiedCheckIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2.2l2.4 1.3 2.7-.5 1.2 2.5 2.5 1.2-.5 2.7L22 12l-1.3 2.4.5 2.7-2.5 1.2-1.2 2.5-2.7-.5L12 21.8l-2.4-1.3-2.7.5-1.2-2.5-2.5-1.2.5-2.7L2 12l1.3-2.4-.5-2.7 2.5-1.2 1.2-2.5 2.7.5L12 2.2z"
        fill="currentColor"
      />
      <path
        d="M8.3 12.3l2.4 2.4 5-5.6"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

/** Nav icon buat "Get Verified" -- badge centang bergerigi, murni
 * `currentColor` (outline pas nggak aktif, isi solid pas aktif) biar selalu
 * ikut warna teks nav & tema (hitam di light mode, putih di dark mode).
 * Beda dari VerifiedCheckIcon/DiamondBadgeIcon di atas yang emang sengaja
 * berwarna tetap buat badge tier di sebelah username. */
export function VerifiedNavIcon({ size = 22, filled = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2.2l2.4 1.3 2.7-.5 1.2 2.5 2.5 1.2-.5 2.7L22 12l-1.3 2.4.5 2.7-2.5 1.2-1.2 2.5-2.7-.5L12 21.8l-2.4-1.3-2.7.5-1.2-2.5-2.5-1.2.5-2.7L2 12l1.3-2.4-.5-2.7 2.5-1.2 1.2-2.5 2.7.5L12 2.2z"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.8}
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
      />
      <path
        d="M8.3 12.3l2.4 2.4 5-5.6"
        stroke={filled ? 'rgb(var(--color-base))' : 'currentColor'}
        strokeWidth={filled ? 1.8 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}


export function DiamondBadgeIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="verifiedMaxDiamondGradient" x1="2" y1="3" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="45%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
      <path d="M7 3h10l4.5 5.2L12 22 2.5 8.2 7 3z" fill="url(#verifiedMaxDiamondGradient)" />
      <path
        d="M7 3l2.3 5.2H2.5L7 3zM17 3l-2.3 5.2h6.8L17 3zM9.3 8.2L12 22l-2.7-13.8zM14.7 8.2L12 22l2.7-13.8z"
        fill="white"
        fillOpacity="0.32"
      />
      <path d="M4.2 5.6l1.1 1.1M19 5.6l-1.1 1.1" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.85" />
    </svg>
  )
}

export function UserCheckIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="9.5" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3 20c1-3.5 3.6-5.3 6.5-5.3S15 16.5 16 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15.5 12.5l2 2 3.5-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function RefreshIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M20 8a8 8 0 10.9 6.5M20 8V3.5M20 8h-4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SettingsIcon({ size = 24, filled = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 2}
        fill={filled ? 'currentColor' : 'none'}
      />
      <path
        d="M19.4 13.5a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V19.5a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H4.5a2 2 0 110-4h.09A1.65 1.65 0 006.1 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H10.5a1.65 1.65 0 001-1.51V4.5a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V10.5a1.65 1.65 0 001.51 1H19.5a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        fill={filled ? 'currentColor' : 'none'}
        strokeLinejoin="round"
        opacity={filled ? 0.35 : 1}
      />
    </svg>
  )
}

export function SunIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MoonIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M20.5 14.5a8.5 8.5 0 11-9-11 6.7 6.7 0 009 11z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export function TrophyIcon({ size = 22, filled = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M7 4h10v5a5 5 0 01-10 0V4z"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 2}
        fill={filled ? 'currentColor' : 'none'}
        strokeLinejoin="round"
      />
      <path
        d="M7 5H4a3 3 0 003 3M17 5h3a3 3 0 01-3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 13.5v3M9 20h6M9.5 20c0-1.7.7-2.8 2.5-3 1.8.2 2.5 1.3 2.5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LinkIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M9.5 14.5l5-5M8 9.5l-2 2a3.5 3.5 0 004.9 4.9l2-2M16 14.5l2-2a3.5 3.5 0 00-4.9-4.9l-2 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CheckIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4.5 4.5L19 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Ikon tas/etalase -- dipakai buat badge listing marketplace & toggle
 * "Post skill listing" di composer. */
export function BriefcaseIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.5 7.5V6a2 2 0 012-2h3a2 2 0 012 2v1.5M3.5 12.5h17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Ikon gembok -- dipakai buat tombol "Lock escrow" (Fase 3.2). */
export function LockIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V7.5a4 4 0 018 0V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** Ikon panah muter balik -- dipakai buat tombol "Refund" di AdminPage
 * (021.1), paralel sama LockIcon buat tombol "Release". */
export function RefundIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M6 8.5H15a5 5 0 015 5 5 5 0 01-5 5H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.5 5L6 8.5l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Ikon bintang -- dipakai buat rating provider (Fase 4). `filled` nentuin
 * solid (rating aktif/dipilih) atau outline (rating kosong). */
export function StarIcon({ size = 14, filled = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}>
      <path
        d="M12 3.5l2.5 5.6 6 .6-4.5 4 1.3 5.9L12 16.9l-5.3 2.7 1.3-5.9-4.5-4 6-.6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TagIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M11.3 4H6a2 2 0 00-2 2v5.3c0 .5.2 1 .6 1.4l8.7 8.7c.8.8 2 .8 2.8 0l5.3-5.3c.8-.8.8-2 0-2.8l-8.7-8.7c-.4-.4-.9-.6-1.4-.6z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="9" r="1.4" fill="currentColor" />
    </svg>
  )
}
