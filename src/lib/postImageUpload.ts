import { supabase } from '../supabaseClient'

// ============================================================================
// POST IMAGE UPLOAD — sama pola kayak avatarUpload.ts, tapi bucket & tujuan
// beda: ini buat gambar yang dilampirkan ke postingan/cast.
// ============================================================================

export const MAX_POST_IMAGE_BYTES = 2 * 1024 * 1024 // 2MB
export const ALLOWED_POST_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const BUCKET = 'post-images'

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/** Validasi file sebelum upload. Balikin pesan error (string) kalau invalid, null kalau lolos. */
export function validatePostImageFile(file: File): string | null {
  if (!ALLOWED_POST_IMAGE_TYPES.includes(file.type)) {
    return 'Unsupported format. Use JPG, PNG, WEBP, or GIF.'
  }
  if (file.size > MAX_POST_IMAGE_BYTES) {
    return `File too large (${formatBytes(file.size)}). Maximum ${formatBytes(MAX_POST_IMAGE_BYTES)}.`
  }
  return null
}

/**
 * Upload gambar postingan ke Supabase Storage (bucket `post-images`) dan
 * balikin public URL-nya. Nama file dibikin unik per wallet + timestamp
 * biar nggak collision.
 */
export async function uploadPostImage(walletAddress: string, file: File): Promise<string> {
  const invalidReason = validatePostImageFile(file)
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
