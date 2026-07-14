export const LISTING_CATEGORIES = [
  'Data extraction',
  'Coding',
  'Research',
  'Writing',
  'Design',
  'Translation',
  'Trading & analytics',
  'Automation',
  'Customer support',
  'Other',
] as const

export type ListingCategory = (typeof LISTING_CATEGORIES)[number]
