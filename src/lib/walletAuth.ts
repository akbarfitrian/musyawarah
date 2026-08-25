// src/lib/walletAuth.ts
//
// Runs the sign-message login flow right after Sphere connect succeeds.
// Call `loginWithWallet(client, walletAddress)` once you have a connected
// ConnectClient and the user's chainPubkey — do this inside
// WalletContext.tsx wherever `connect()` currently resolves, before you
// consider the wallet "connected" for the purposes of posting/liking/etc.
//
// The result is a Supabase client whose requests carry a JWT proving the
// caller controls `walletAddress`. Keep using the plain anon `supabase`
// client (from src/supabaseClient.ts) for read-only queries; swap to the
// authed client returned here for anything that calls a mutating RPC.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { ConnectClient } from '@unicitylabs/sphere-sdk/connect'
import { anonSupabase, setAuthedClient, clearAuthedClient } from '../supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Same origin as your Supabase project's Edge Functions.
const WALLET_LOGIN_URL = `${SUPABASE_URL}/functions/v1/wallet-login`

export interface WalletSession {
  accessToken: string
  expiresAt: number // epoch ms
  walletAddress: string
  client: SupabaseClient
}

/**
 * Runs: request nonce -> ask Sphere wallet to sign it -> exchange for a JWT
 * -> swaps the shared `supabase` export (from src/supabaseClient.ts) so
 * every existing `supabase.rpc(...)` call in the app starts sending this
 * session's Authorization header automatically.
 *
 * Throws if the user rejects the signature in their wallet, or if
 * server-side verification fails for any reason. Callers should treat a
 * throw here as "stay logged out of mutating actions" — reads via
 * `anonSupabase` still work.
 */
export async function loginWithWallet(
  client: ConnectClient,
  walletAddress: string,
): Promise<WalletSession> {
  // 1. Get a fresh one-time nonce for this wallet (safe to call as anon).
  const { data: nonce, error: nonceErr } = await anonSupabase.rpc(
    'request_wallet_nonce',
    { p_wallet: walletAddress },
  )
  if (nonceErr || !nonce) {
    throw new Error(nonceErr?.message ?? 'failed to obtain login nonce')
  }

  // 2. Ask the Sphere wallet to sign it. This opens the wallet's own
  //    confirmation UI (same pattern as the existing sendTip() intent flow)
  //    — the user sees exactly what they're signing.
  const intentResult = (await client.intent('sign_message', {
    message: nonce,
  })) as { signature?: string; pubkey?: string } | undefined

  console.log('intent result:', JSON.stringify(intentResult))

  const signature = intentResult?.signature
  if (!signature) {
    throw new Error('Wallet did not return a signature (user likely rejected the request).')
  }

  // 3. Exchange the signed nonce for a JWT.
  const res = await fetch(WALLET_LOGIN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet_address: walletAddress, nonce, signature }),
  })

  const body = await res.json()
  if (!res.ok) {
    throw new Error(body?.error ?? `wallet-login failed with status ${res.status}`)
  }

  const accessToken: string = body.access_token
  const expiresInSec: number = body.expires_in

  // 4. Build a Supabase client that sends this JWT on every request, and
  //    make it the app-wide default. We use a header-attached client rather
  //    than supabase.auth.setSession() because there is no matching
  //    refresh_token/auth.users row — this session lives entirely off the
  //    app_metadata.wallet_address claim, not a real GoTrue user.
  const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  setAuthedClient(authedClient)

  return {
    accessToken,
    expiresAt: Date.now() + expiresInSec * 1000,
    walletAddress,
    client: authedClient,
  }
}

/** Call on disconnect/logout to drop back to the anon-only client. */
export function logoutWallet() {
  clearAuthedClient()
}

/** True once we're within 60s of expiry — re-run loginWithWallet before then. */
export function sessionNeedsRefresh(session: WalletSession | null): boolean {
  if (!session) return true
  return Date.now() > session.expiresAt - 60_000
}
