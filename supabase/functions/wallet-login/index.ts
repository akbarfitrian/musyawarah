// supabase/functions/wallet-login/index.ts
//
// Verifies that the caller actually controls the Sphere wallet they claim to
// (via a signed one-time nonce), then mints a Supabase-compatible JWT with
// `app_metadata.wallet_address` set. Every mutating RPC in the app checks
// that claim via `assert_wallet_owner()` (see the migration in
// supabase/migrations/2026_08_24_wallet_auth_hardening.sql) instead of
// trusting a client-supplied wallet parameter.
//
// Deploy: supabase functions deploy wallet-login
// Secrets needed (supabase secrets set ...):
//   SUPABASE_URL                — auto-provided, do not set manually
//   SUPABASE_SERVICE_ROLE_KEY   — auto-provided, do not set manually
//   WALLET_JWT_SECRET           — your project's JWT secret
//                                  (Dashboard -> Project Settings -> API -> JWT Secret)
//                                  NEVER expose this to the client.
//                                  NOTE: can't be named SUPABASE_JWT_SECRET — the
//                                  Supabase CLI rejects any custom secret whose name
//                                  starts with SUPABASE_ (that prefix is reserved for
//                                  the auto-injected vars above), so this one uses a
//                                  different name.

import { createClient } from "npm:@supabase/supabase-js@2";
import { verifySignedMessage } from "npm:@unicitylabs/sphere-sdk@0.14.3/core";
import { create as signJwt, type Header, type Payload } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("WALLET_JWT_SECRET")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Browsers send a preflight OPTIONS request before the actual POST because
// the client sends a JSON body cross-origin. Without these headers on both
// the preflight response AND the real response, the browser blocks the
// request client-side before it even reaches our code (hence "Failed to
// fetch" with no useful server-side error).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

Deno.serve(async (req) => {
  // Preflight: browser asks "am I allowed to POST here from this origin
  // with these headers?" before sending the real request. Must return 2xx
  // with the CORS headers and no body.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  let body: { wallet_address?: string; nonce?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  const { wallet_address, nonce, signature } = body;

  if (!wallet_address || !nonce || !signature) {
    return jsonResponse(
      { error: "wallet_address, nonce, and signature are all required" },
      400,
    );
  }

  // The nonce is now a structured, human-readable message (see
  // request_wallet_nonce in supabase/migrations/2026_08_25_siwe_style_nonce.sql),
  // e.g.:
  //   Sign in to Musyawarah
  //
  //   Domain: musyawarah.app
  //   Address: DIRECT://<pubkey>
  //   Nonce: <random>
  //   Issued At: 2026-08-25T07:00:04.020Z
  //   Expiration Time: 2026-08-25T07:10:04.020Z
  //
  // We don't re-validate the domain here — only a request from an allowed
  // origin could have gotten request_wallet_nonce to mint a nonce claiming
  // that domain in the first place (see the allowlist check there). What we
  // DO need to check here: the Address line matches the wallet_address this
  // request claims to authenticate as (so a signed nonce for wallet A can't
  // be replayed as wallet B), and that the message's own declared
  // expiration hasn't passed.
  const addressMatch = nonce.match(/^Address:\s*DIRECT:\/\/([0-9a-fA-F]+)\s*$/m);
  if (!addressMatch) {
    return jsonResponse({ error: "malformed nonce: missing Address line" }, 400);
  }
  if (addressMatch[1].toLowerCase() !== wallet_address.toLowerCase()) {
    return jsonResponse({ error: "nonce does not match wallet_address" }, 400);
  }

  const expirationMatch = nonce.match(/^Expiration Time:\s*(\S+)\s*$/m);
  if (!expirationMatch) {
    return jsonResponse({ error: "malformed nonce: missing Expiration Time" }, 400);
  }
  const expiresAt = new Date(expirationMatch[1]);
  if (Number.isNaN(expiresAt.getTime()) || Date.now() > expiresAt.getTime()) {
    return jsonResponse({ error: "nonce expired" }, 401);
  }

  // 1. Verify the signature against the claimed pubkey. `wallet_address` here
  //    is the wallet's chainPubkey (compressed secp256k1, 66-char hex) — the
  //    same value used as `wallet_address` everywhere else in the schema.
  let signatureValid = false;
  try {
    signatureValid = verifySignedMessage(nonce, signature, wallet_address);
  } catch (err) {
    console.error("[wallet-login] signature verification threw", err);
    return jsonResponse({ error: "malformed signature" }, 400);
  }

  if (!signatureValid) {
    return jsonResponse({ error: "signature does not match wallet_address" }, 401);
  }

  // 2. Atomically consume the nonce (one-time use, <10 min old). If this
  //    fails, either it was already used or it expired.
  const { data: consumed, error: consumeErr } = await admin.rpc(
    "consume_wallet_nonce",
    { p_wallet: wallet_address, p_nonce: nonce },
  );

  if (consumeErr) {
    console.error("[wallet-login] consume_wallet_nonce error", consumeErr);
    return jsonResponse({ error: "internal error validating nonce" }, 500);
  }
  if (!consumed) {
    return jsonResponse({ error: "nonce expired or already used" }, 401);
  }

  // 3. Mint a Supabase-shaped JWT. `sub` is random per session — nothing in
  //    the schema relies on a stable auth.users id, every RPC keys off
  //    app_metadata.wallet_address instead.
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresInSec = 60 * 60; // 1 hour; client re-runs this flow to refresh

  const payload: Payload = {
    aud: "authenticated",
    role: "authenticated",
    sub: crypto.randomUUID(),
    iat: nowSec,
    exp: nowSec + expiresInSec,
    app_metadata: { wallet_address },
  };

  const header: Header = { alg: "HS256", typ: "JWT" };
  const key = await importHmacKey(JWT_SECRET);
  const token = await signJwt(header, payload, key);

  return jsonResponse({
    access_token: token,
    expires_in: expiresInSec,
    wallet_address,
  });
});