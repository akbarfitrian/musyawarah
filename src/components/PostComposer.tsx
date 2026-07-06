import { useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import { useProfile } from '../contexts/ProfileContext'
import { useVerification } from '../hooks/useVerification'
import { usePostQuota } from '../hooks/usePostQuota'
import { avatarColor, avatarInitial } from '../utils/avatar'
import { uploadPostImage, validatePostImageFile } from '../lib/postImageUpload'
import { canAttachImage, maxPostChars, TIER_CONFIG } from '../lib/verification'
import { ImageIcon, XIcon } from './icons'

export function PostComposer({
  onPosted,
  onGetVerified,
}: {
  onPosted: () => void
  /** Dipanggil pas tombol "Upgrade" di pesan limit tercapai diklik. */
  onGetVerified?: () => void
}) {
  const { walletAddress, connect } = useWallet()
  const { profile } = useProfile()
  const { tier: verificationTier } = useVerification()
  const { limit: dailyLimit, remaining, reachedLimit, refresh: refreshQuota } = usePostQuota(
    walletAddress,
    verificationTier
  )
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  const MAX_LEN = maxPostChars(verificationTier)
  const imageAllowed = canAttachImage(verificationTier)

  function handleImagePicked(file: File | undefined) {
    if (!file) return
    if (!imageAllowed) {
      setImageError(`Attaching images needs ${TIER_CONFIG.verified_pro.label} or higher.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setImageError(null)

    const invalidReason = validatePostImageFile(file)
    if (invalidReason) {
      setImageError(invalidReason)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function removeImage() {
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
    setImageError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!walletAddress) return
    const trimmed = content.trim()
    if (!trimmed && !imageFile) return

    if (reachedLimit) {
      setError(
        dailyLimit === 1
          ? 'You’ve used today’s free post. Get Verified to unlock more, or come back after 00:00 UTC.'
          : `You’ve hit today’s limit of ${dailyLimit} posts. Upgrade your tier for more, or come back after 00:00 UTC.`
      )
      return
    }

    setPosting(true)
    setError(null)
    try {
      let imageUrl: string | null = null
      if (imageFile) {
        imageUrl = await uploadPostImage(walletAddress, imageFile)
      }

      // Manggil server-side function (bukan .insert() langsung) -- kuota
      // harian & batas karakter per tier ditegakkan ULANG di server di
      // dalam create_post(), lihat supabase/002_harden_writes.sql. Cek di
      // atas (reachedLimit dll) cuma buat UX instan, bukan satu-satunya
      // penjaga lagi.
      const { error: postError } = await supabase.rpc('create_post', {
        p_wallet: walletAddress,
        p_content: trimmed,
        p_image_url: imageUrl,
      })

      if (postError) throw postError

      setContent('')
      removeImage()
      refreshQuota()
      onPosted()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to post. Try again.'
      setError(message)
      console.error(e)
    } finally {
      setPosting(false)
    }
  }

  const charsRemaining = MAX_LEN - content.length
  const nearLimit = charsRemaining <= 40
  const canSubmit = !posting && Boolean(content.trim() || imageFile) && Boolean(walletAddress) && !reachedLimit

  return (
    <div className="mx-4 mb-2 mt-4 flex gap-3 rounded-2xl border border-surface-border bg-surface p-4 shadow-card">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
        style={{ background: walletAddress ? avatarColor(walletAddress) : '#1F2937' }}
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : walletAddress ? (
          avatarInitial(walletAddress)
        ) : (
          ''
        )}
      </div>

      <div className="min-w-0 flex-1">
        <textarea
          id="composer-textarea"
          value={content}
          maxLength={MAX_LEN}
          placeholder={walletAddress ? 'What’s happening?' : 'Connect your wallet to start posting'}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => {
            if (!walletAddress) connect()
          }}
          rows={1}
          className="w-full resize-none bg-transparent py-1.5 text-[17px] leading-snug text-ink placeholder:text-ink-faint outline-none"
        />

        {imagePreview && (
          <div className="relative mt-2 inline-block overflow-hidden rounded-2xl border border-surface-border">
            <img src={imagePreview} alt="Image preview" className="max-h-64 max-w-full object-cover" />
            <button
              type="button"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
              onClick={removeImage}
              aria-label="Remove image"
              title="Remove image"
            >
              <XIcon size={14} />
            </button>
          </div>
        )}
        {imageError && (
          <p className="mt-1 text-xs text-danger">
            {imageError}
            {!imageAllowed && onGetVerified && (
              <>
                {' '}
                <button
                  type="button"
                  className="font-semibold text-brand-violetSoft underline hover:text-brand-violet"
                  onClick={onGetVerified}
                >
                  Get Verified
                </button>
              </>
            )}
          </p>
        )}
        {error && (
          <p className="mt-1 text-xs text-danger">
            {error}
            {reachedLimit && onGetVerified && (
              <>
                {' '}
                <button
                  type="button"
                  className="font-semibold text-brand-violetSoft underline hover:text-brand-violet"
                  onClick={onGetVerified}
                >
                  Get Verified
                </button>
              </>
            )}
          </p>
        )}

        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-brand-blue transition-colors hover:bg-brand-blue/10 disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-transparent"
            onClick={() => {
              if (!imageAllowed) {
                setImageError(`Attaching images needs ${TIER_CONFIG.verified_pro.label} or higher.`)
                return
              }
              fileInputRef.current?.click()
            }}
            disabled={!walletAddress || posting}
            aria-label="Attach image"
            title={imageAllowed ? 'Attach image' : `Attaching images needs ${TIER_CONFIG.verified_pro.label} or higher`}
          >
            <ImageIcon size={19} />
          </button>
          {imageAllowed && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="visually-hidden"
              onChange={(e) => handleImagePicked(e.target.files?.[0])}
            />
          )}

          {content.length > 0 && (
            <span className={`ml-1 text-xs font-medium tabular-nums ${nearLimit ? 'text-danger' : 'text-ink-faint'}`}>
              {charsRemaining}
            </span>
          )}

          {walletAddress && dailyLimit !== null && (
            <span className="ml-2 text-xs font-medium tabular-nums text-ink-faint">
              {remaining}/{dailyLimit} posts left today
            </span>
          )}

          <button
            className="ml-auto rounded-full bg-brand-gradient px-5 py-1.5 text-[14px] font-semibold text-accent-contrast shadow-glow transition-transform duration-150 hover:scale-[1.03] hover:shadow-glowCyan active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-glow"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {posting ? (imageFile ? 'Uploading…' : 'Sending…') : reachedLimit ? 'Limit reached' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}
