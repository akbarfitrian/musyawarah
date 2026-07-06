import { supabase } from '../supabaseClient'

// ============================================================================
// AVATAR UPLOAD — tahap awal, jadi batasnya sengaja dibikin konservatif.
// Naikin MAX_AVATAR_BYTES belakangan kalau butuh foto resolusi lebih gede,
// tapi inget makin gede limit-nya makin lambat loading feed-nya.
// ============================================================================

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2MB
export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const BUCKET = 'avatars'

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/** Validasi file sebelum upload. Balikin pesan error (string) kalau invalid, null kalau lolos. */
export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return 'Unsupported format. Use JPG, PNG, WEBP, or GIF.'
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return `File too large (${formatBytes(file.size)}). Maximum ${formatBytes(MAX_AVATAR_BYTES)}.`
  }
  return null
}

/**
 * Upload foto profil ke Supabase Storage (bucket `avatars`) dan balikin public URL-nya.
 * Nama file dibikin unik per wallet + timestamp biar nggak collision & browser
 * gampang cache-bust pas foto diganti.
 */
export async function uploadAvatar(walletAddress: string, file: File): Promise<string> {
  const invalidReason = validateAvatarFile(file)
  if (invalidReason) throw new Error(invalidReason)

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${walletAddress}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
