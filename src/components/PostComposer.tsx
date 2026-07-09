import { useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import { useProfile } from '../contexts/ProfileContext'
import { useVerification } from '../hooks/useVerification'
import { usePostQuota } from '../hooks/usePostQuota'
import { avatarColor, avatarInitial } from '../utils/avatar'
import { uploadPostImage, validatePostImageFile } from '../lib/postImageUpload'
import { canAttachImage, maxPostChars, TIER_CONFIG } from '../lib/verification'
import { LISTING_CATEGORIES } from '../config/listingCategories'
import type { ListingPriceMode } from '../types'
import { BriefcaseIcon, ImageIcon, XIcon } from './icons'

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

  // --- Marketplace (draft §1a/§3) — toggle "Post skill listing" ---
  const [isListing, setIsListing] = useState(false)
  const [listingTitle, setListingTitle] = useState('')
  const [listingCategory, setListingCategory] = useState<string>(LISTING_CATEGORIES[0])
  const [listingPriceMode, setListingPriceMode] = useState<ListingPriceMode>('task')
  const [listingPriceAmount, setListingPriceAmount] = useState('')

  function toggleListing() {
    setIsListing((v) => !v)
    setError(null)
  }

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

    const trimmedTitle = listingTitle.trim()
    const priceAmount = Number(listingPriceAmount)
    if (isListing) {
      if (!trimmedTitle) {
        setError('Give your listing a title.')
        return
      }
      if (!listingPriceAmount || !(priceAmount > 0)) {
        setError('Enter a valid price for your listing.')
        return
      }
    }

    setPosting(true)
    setError(null)
    try {
      let imageUrl: string | null = null
      if (imageFile) {
        imageUrl = await uploadPostImage(walletAddress, imageFile)
      }

      // Manggil server-side function (bukan .insert() langsung) -- kuota
      // harian, batas karakter per tier, DAN sekarang validasi field listing
      // ditegakkan ULANG di server di dalam create_post(), lihat
      // supabase/006_marketplace_listings.sql. Cek di atas (reachedLimit,
      // title/price kosong dll) cuma buat UX instan, bukan satu-satunya
      // penjaga lagi.
      const { error: postError } = await supabase.rpc('create_post', {
        p_wallet: walletAddress,
        p_content: trimmed,
        p_image_url: imageUrl,
        p_is_listing: isListing,
        p_listing_title: isListing ? trimmedTitle : null,
        p_listing_category: isListing ? listingCategory : null,
        p_listing_price_amount: isListing ? priceAmount : null,
        p_listing_price_mode: isListing ? listingPriceMode : null,
        p_listing_coin_symbol: isListing ? 'UCT' : null,
      })

      if (postError) throw postError

      setContent('')
      removeImage()
      setIsListing(false)
      setListingTitle('')
      setListingCategory(LISTING_CATEGORIES[0])
      setListingPriceMode('task')
      setListingPriceAmount('')
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
  const listingValid = !isListing || (listingTitle.trim().length > 0 && Number(listingPriceAmount) > 0)
  const canSubmit =
    !posting && Boolean(content.trim() || imageFile) && Boolean(walletAddress) && !reachedLimit && listingValid

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
          placeholder={
            !walletAddress
              ? 'Connect your wallet to start posting'
              : isListing
                ? 'Describe the skill/agent you’re offering…'
                : 'What’s happening?'
          }
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => {
            if (!walletAddress) connect()
          }}
          rows={1}
          className="w-full resize-none bg-transparent py-1.5 text-[17px] leading-snug text-ink placeholder:text-ink-faint outline-none"
        />

        {isListing && (
          <div className="mt-2 space-y-2 rounded-xl border border-gold/30 bg-gold/5 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-gold">
                <BriefcaseIcon size={14} />
                Skill listing
              </span>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
                onClick={toggleListing}
                aria-label="Remove listing details"
                title="Remove listing details"
              >
                <XIcon size={12} />
              </button>
            </div>

            <input
              type="text"
              value={listingTitle}
              maxLength={80}
              onChange={(e) => setListingTitle(e.target.value)}
              placeholder="Listing title, e.g. DataScout — web data extraction"
              className="w-full rounded-lg border border-surface-border bg-base px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-gold/60"
            />

            <div className="flex flex-wrap gap-2">
              <select
                value={listingCategory}
                onChange={(e) => setListingCategory(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-surface-border bg-base px-2 py-2 text-[13px] text-ink outline-none focus:border-gold/60"
              >
                {LISTING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={listingPriceMode}
                onChange={(e) => setListingPriceMode(e.target.value as ListingPriceMode)}
                className="rounded-lg border border-surface-border bg-base px-2 py-2 text-[13px] text-ink outline-none focus:border-gold/60"
              >
                <option value="task">Per task</option>
                <option value="subscription">Per month</option>
              </select>

              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-surface-border bg-base px-2 py-2">
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={listingPriceAmount}
                  onChange={(e) => setListingPriceAmount(e.target.value)}
                  placeholder="Price"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
                />
                <span className="shrink-0 text-[12px] font-medium text-ink-faint">UCT</span>
              </div>
            </div>

            {verificationTier === 'none' && (
              <p className="text-[11px] text-ink-faint">
                Free tier descriptions are capped at 60 characters.{' '}
                {onGetVerified && (
                  <button
                    type="button"
                    className="font-semibold text-brand-violetSoft underline hover:text-brand-violet"
                    onClick={onGetVerified}
                  >
                    Upgrade
                  </button>
                )}{' '}
                for a longer skill description.
              </p>
            )}
          </div>
        )}

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

          <button
            type="button"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              isListing ? 'bg-gold/15 text-gold' : 'text-ink-faint hover:bg-gold/10 hover:text-gold'
            }`}
            onClick={toggleListing}
            disabled={!walletAddress || posting}
            aria-label={isListing ? 'Remove skill listing details' : 'Post as a skill listing'}
            title={isListing ? 'Remove skill listing details' : 'Post as a skill listing'}
          >
            <BriefcaseIcon size={18} />
          </button>

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
