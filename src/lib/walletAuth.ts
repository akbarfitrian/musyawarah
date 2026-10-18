// Wallet signature login: proves to Supabase that the caller really controls
// the wallet they claim, and stores the resulting JWT for supabaseClient.ts.
//
//   1. request_wallet_nonce(pubkey, domain)  -> structured sign-in message
//   2. wallet signs it (Sphere Connect `sign_message` intent)
//   3. POST { wallet_address, nonce, signature } to the wallet-login Edge Function
//   4. store the returned JWT; supabaseClient attaches it to every request
//
// Server side: supabase/functions/wallet-login + migrations 2026_08_24/25.

import type { ConnectClient } from '@unicitylabs/sphere-sdk/connect'
import { supabase } from '../supabaseClient'
import { clearAuthSession, setAuthSession } from './authSession'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export interface WalletLoginResult {
  wallet: string
  expiresAt: number
}

export class WalletLoginError extends Error {
  readonly userRejected: boolean
  constructor(message: string, userRejected = false) {
    super(message)
    this.name = 'WalletLoginError'
    this.userRejected = userRejected
  }
}

// Sphere Connect error code for "user closed / rejected the wallet prompt".
const USER_REJECTED_CODE = 4003

/**
 * The shape of the `sign_message` intent result isn't documented in the SDK
 * (the wallet app implements it), so accept both a bare hex string and an
 * object carrying the signature. The server expects the 130-char hex
 * signature (v + r + s) as produced by the SDK's `signMessage`.
 */
function extractSignature(result: unknown): string | null {
  if (typeof result === 'string') return result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    for (const key of ['signature', 'sig', 'result']) {
      if (typeof r[key] === 'string') return r[key] as string
    }
  }
  return null
}

async function requestNonce(pubkey: string): Promise<string> {
  // An expired token would make PostgREST reject this call, so make sure we
  // are anonymous while asking for a nonce.
  clearAuthSession()

  const { data, error } = await supabase.rpc('request_wallet_nonce', {
    p_wallet: pubkey,
    p_domain: window.location.host,
  })
  if (error) throw new WalletLoginError(`Gagal minta nonce login: ${error.message}`)
  if (typeof data !== 'string' || !data) throw new WalletLoginError('Server mengembalikan nonce yang tidak valid.')
  return data
}

async function exchangeSignature(pubkey: string, nonce: string, signature: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new WalletLoginError('Supabase belum dikonfigurasi (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/wallet-login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ wallet_address: pubkey, nonce, signature }),
  })

  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
  }

  if (!res.ok || !body.access_token) {
    throw new WalletLoginError(body.error ?? `wallet-login gagal (HTTP ${res.status}).`)
  }
  return { token: body.access_token, expiresInSec: body.expires_in ?? 3600 }
}

/**
 * Runs the full challenge/response flow for `pubkey` (the wallet's
 * `chainPubkey`, 66-char hex) and stores the resulting session.
 *
 * `beforeSign` lets the caller bring the wallet popup to the front so the user
 * notices the signature request.
 */
export async function loginWithWallet(
  client: ConnectClient,
  pubkey: string,
  beforeSign?: () => void
): Promise<WalletLoginResult> {
  if (!pubkey) throw new WalletLoginError('Wallet belum punya chainPubkey, tidak bisa login.')
  pubkey = pubkey.toLowerCase()

  const nonce = await requestNonce(pubkey)

  beforeSign?.()

  let signResult: unknown
  try {
    signResult = await client.intent('sign_message', { message: nonce })
  } catch (err) {
    const code = (err as { code?: number } | null)?.code
    const message = err instanceof Error ? err.message : 'Wallet menolak permintaan tanda tangan.'
    throw new WalletLoginError(message, code === USER_REJECTED_CODE)
  }

  const signature = extractSignature(signResult)
  if (!signature) {
    throw new WalletLoginError('Wallet tidak mengembalikan signature yang bisa dibaca.')
  }

  const { token, expiresInSec } = await exchangeSignature(pubkey, nonce, signature)
  const expiresAt = Date.now() + expiresInSec * 1000
  setAuthSession({ token, expiresAt, wallet: pubkey })
  return { wallet: pubkey, expiresAt }
}

export function logoutWallet() {
  clearAuthSession()
}
