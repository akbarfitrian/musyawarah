import { supabase } from '../supabaseClient'
import { compressImageToWebp } from './imageCompression'

// Final upload cap (after compression)
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024
// Raw picked file cap — generous, since it gets compressed before upload
export const MAX_RAW_AVATAR_BYTES = 15 * 1024 * 1024
export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const BUCKET = 'avatars'

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return 'Unsupported format. Use JPG, PNG, WEBP, or GIF.'
  }
  if (file.size > MAX_RAW_AVATAR_BYTES) {
    return `File too large (${formatBytes(file.size)}). Maximum ${formatBytes(MAX_RAW_AVATAR_BYTES)}.`
  }
  return null
}

export async function uploadAvatar(walletAddress: string, file: File): Promise<string> {
  const invalidReason = validateAvatarFile(file)
  if (invalidReason) throw new Error(invalidReason)

  // Avatars are shown small, so we can compress harder than post images.
  const compressed = await compressImageToWebp(file, { maxDimension: 512, quality: 0.8 })

  if (compressed.size > MAX_AVATAR_BYTES) {
    throw new Error(
      `Image still too large after compression (${formatBytes(compressed.size)}). Maximum ${formatBytes(MAX_AVATAR_BYTES)}.`
    )
  }

  const ext = compressed.name.split('.').pop()?.toLowerCase() || 'webp'
  const path = `${walletAddress}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    cacheControl: '3600',
    upsert: false,
    contentType: compressed.type,
  })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
