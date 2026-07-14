import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useWallet } from '../contexts/WalletContext'
import {
  TIER_CONFIG,
  computeExpiresAtIso,
  priceForInterval,
  type BillingInterval,
  type VerificationTier,
} from '../lib/verification'

const TREASURY_WALLET = import.meta.env.VITE_VERIFICATION_TREASURY_WALLET as string | undefined

export function useVerification() {
  const { walletAddress, sendTip } = useWallet()
  const [tier, setTier] = useState<VerificationTier>('none')
  const [billingInterval, setBillingInterval] = useState<BillingInterval | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasingTier, setPurchasingTier] = useState<VerificationTier | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      setTier('none')
      setBillingInterval(null)
      setExpiresAt(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('verifications')
        .select('tier, billing_interval, expires_at')
        .eq('wallet_address', walletAddress)
        .maybeSingle()

      if (fetchError) throw fetchError

      const rowExpiresAt = data?.expires_at ?? null
      const isExpired = Boolean(rowExpiresAt) && new Date(rowExpiresAt as string).getTime() <= Date.now()

      setTier(isExpired ? 'none' : ((data?.tier as VerificationTier | undefined) ?? 'none'))
      setBillingInterval((data?.billing_interval as BillingInterval | undefined) ?? null)
      setExpiresAt(rowExpiresAt)
    } catch (e) {
      console.error('[MUSYAWARAH] Gagal ngambil status verifikasi:', e)
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    refresh()
  }, [refresh])

  const purchase = useCallback(
    async (targetTier: VerificationTier, interval: BillingInterval = 'monthly') => {
      setError(null)

      if (!walletAddress) {
        const message = 'Connect your wallet first.'
        setError(message)
        throw new Error(message)
      }
      if (targetTier === 'none') {
        const message = 'Tier "none" is free, nothing to buy.'
        setError(message)
        throw new Error(message)
      }
      if (!TREASURY_WALLET) {
        const message =
          'Verification purchases are not configured yet (missing VITE_VERIFICATION_TREASURY_WALLET in .env.local).'
        setError(message)
        throw new Error(message)
      }

      const price = priceForInterval(targetTier, interval)
      const newExpiresAt = computeExpiresAtIso(interval)
      setPurchasingTier(targetTier)
      try {
        const { txHash } = await sendTip(TREASURY_WALLET, price)

        const { data, error: purchaseError } = await supabase.rpc('purchase_verification', {
          p_wallet: walletAddress,
          p_tier: targetTier,
          p_billing: interval,
          p_amount: price,
          p_tx_hash: txHash,
        })
        if (purchaseError) throw purchaseError

        setTier(targetTier)
        setBillingInterval(interval)
        setExpiresAt(data?.expires_at ?? newExpiresAt)
        return { txHash }
      } catch (e) {
        console.error('[MUSYAWARAH] Gagal beli verifikasi:', e)
        const message = e instanceof Error ? e.message : 'Failed to purchase verification. Try again.'
        setError(message)
        throw e
      } finally {
        setPurchasingTier(null)
      }
    },
    [walletAddress, sendTip]
  )

  const monthlyPrice = useMemo(
    () => (targetTier: VerificationTier) => TIER_CONFIG[targetTier].monthlyPriceUct,
    []
  )

  return { tier, billingInterval, expiresAt, loading, purchasingTier, error, purchase, refresh, monthlyPrice }
}
