import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  console.warn(
    '[MUSYAWARAH] Supabase belum dikonfigurasi. Copy .env.example ke .env.local dan isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY.'
  )
}

// `supabase` is intentionally a mutable binding (not `const`). ES module
// exports are live bindings, so every file that does
// `import { supabase } from '../supabaseClient'` and later calls
// `supabase.rpc(...)` automatically starts using the authenticated client
// the moment `setAuthedClient()` runs below — without editing any of those
// call sites individually.
export let supabase = createClient(url ?? '', anonKey ?? '')

/** Anon-only client, always available even after login (e.g. for logout / re-login flows). */
export const anonSupabase = supabase

/**
 * Called once by walletAuth.ts right after a wallet finishes the
 * sign-message login flow. Every subsequent `supabase.rpc(...)` call
 * anywhere in the app — existing code included — now carries the wallet's
 * verified JWT.
 */
export function setAuthedClient(client: SupabaseClient) {
  supabase = client
}

/** Called on disconnect/logout — drops back to the anon-only client. */
export function clearAuthedClient() {
  supabase = anonSupabase
}
