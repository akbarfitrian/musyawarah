// Kategori listing marketplace -- disalin dari Ink (src/config/categories.ts)
// biar konsisten pas listing lama di-migrasi manual ke sini nanti (Fase 5).
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
