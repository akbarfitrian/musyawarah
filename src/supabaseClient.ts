import { createClient } from '@supabase/supabase-js'
import { getAccessToken } from './lib/authSession'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  console.warn(
    '[MUSYAWARAH] Supabase belum dikonfigurasi. Copy .env.example ke .env.local dan isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY.'
  )
}

// Once the user has completed the wallet signature challenge (see
// lib/walletAuth.ts) we have a JWT carrying `app_metadata.wallet_address`.
// Attach it to every request so `assert_wallet_owner()` in Postgres can see
// who is really calling. Before login (or after the token expires) requests
// fall back to the plain anon key, which is fine for public reads.
//
// supabase-js sets `Authorization: Bearer <anon key>` before it reaches this
// fetch, so overriding the header here wins.
const fetchWithWalletJwt: typeof fetch = (input, init) => {
  const token = getAccessToken()
  if (!token) return fetch(input, init)

  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  global: { fetch: fetchWithWalletJwt },
})
