// In-memory store for the wallet-login JWT.
//
// Deliberately NOT persisted to localStorage: the token is only valid for 1h
// and re-issuing it requires a wallet signature anyway, so persisting it would
// only widen the blast radius of an XSS without saving the user any prompts.
//
// This module has no imports on purpose — supabaseClient.ts reads from it, and
// walletAuth.ts (which imports supabaseClient) writes to it. Keeping the store
// dependency-free avoids a circular import between those two.

interface Session {
  token: string
  /** epoch ms */
  expiresAt: number
  /** the pubkey the token was issued for */
  wallet: string
}

// Treat the token as expired slightly early so we never send one that dies
// in-flight (PostgREST answers an expired JWT with a hard 401, even for reads).
const EXPIRY_SKEW_MS = 30_000

let session: Session | null = null

export function setAuthSession(next: Session) {
  session = next
}

export function clearAuthSession() {
  session = null
}

export function getAuthSession(): Session | null {
  if (!session) return null
  if (Date.now() >= session.expiresAt - EXPIRY_SKEW_MS) return null
  return session
}

export function getAccessToken(): string | null {
  return getAuthSession()?.token ?? null
}
