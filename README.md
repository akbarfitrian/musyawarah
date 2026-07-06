# MUSYAWARAH

A simple Warpcast-style social app: connect wallet, post, tip. v0 — rough
around the edges, built incrementally.

## Features so far

- Wallet-address-based identity (no separate signup/login)
- Text posts (character limit varies by verification tier — Free 100,
  Verified 300, Verified Pro 500, Verified Max 1,000)
- Feed, sorted newest first
- Tipping on other people's posts, recorded in Supabase
- **3-tier verification** (Verified / Verified Pro / Verified Max) — paid for
  with UCT, monthly or yearly (yearly gets a 15% discount), grants a badge
  next to the username, a bigger daily posting quota, a looser character
  limit, and (from Verified Pro) the ability to attach images / (Verified Max
  only) the ability to edit posts (see the "Verification & posting quota"
  section below)
- **Real-time wallet balance** — total (USD) plus a per-token breakdown,
  shown in the `ConnectWallet` component (sidebar/topbar), auto-updating on
  every incoming/outgoing transfer (see the "Wallet connect" section below)
- **Brand mark** — the app icon/favicon and in-app logo mark use the
  uploaded "M" logo (`public/logo.png`), rendered via the `LogoMark`
  component in `src/components/icons.tsx`

## Wallet connect (Sphere Connect protocol)

`src/contexts/WalletContext.tsx` now connects to a real Sphere wallet via the
**Sphere Connect protocol** (`@unicitylabs/sphere-sdk/connect`) instead of
demo mode. There are 3 connection modes, tried in order — following the same
pattern as
[`unicity-sphere/sphere-sdk-connect-example`](https://github.com/unicity-sphere/sphere-sdk-connect-example):

| Priority | Mode | When it's used |
|---|---|---|
| P1 | **Iframe** | Musyawarah is loaded inside Sphere's own iframe (as a "Sphere Agent") |
| P2 | **Extension** | The user has the Sphere browser extension installed |
| P3 | **Popup** | Fallback: opens the Sphere wallet (`sphere.unicity.network`) as a popup window |

Other details:

- A silent auto-connect is attempted every time the app loads (instant for
  P1/P2, resumes the session for P3 via `sessionStorage`). If it fails or
  hasn't been approved yet, a "Connect Wallet" button appears instead.
- `sendTip()` calls the real `send` intent from the Sphere Connect protocol,
  converting the amount to base units (integer, not float) before sending.
- The UCT coinId (needs the 64-hex format required by the `send` intent) is
  auto-resolved from the wallet via `sphere_getAssets`/`sphere_getTokens`. If
  it can't be found, there's a fallback via the `VITE_SPHERE_UCT_COIN_ID`
  env var — see `.env.example` and the comments in `resolveUctCoin()`.
- Wallet lock/unlock, and disconnects initiated from the wallet side, are
  handled via the `wallet:locked` and `identity:changed` events (auto-pushed,
  no manual subscription needed).
- **Real-time balance**: as soon as the wallet connects, `WalletContext`
  queries `sphere_getAssets` (+ optionally `sphere_getFiatBalance`) for the
  initial balance, then subscribes to the `transfer:incoming` and
  `transfer:confirmed` events — on every transaction the balance is
  refetched automatically, no polling required. Exposed via `useWallet()` as
  `assets`, `totalFiat`, `balanceLoading`, and `refreshBalance()` for a
  manual refresh. Displayed in `ConnectWallet.tsx` (total USD next to the
  wallet address, per-token breakdown in the dropdown menu).

**Not yet testable/verifiable without a real Sphere wallet instance**: the
exact shape of the `send` intent's response (the tx hash field name), the
exact UCT coinId format on the network you're using, and the exact shape of
the `sphere_getAssets`/`sphere_getFiatBalance` responses (amount/symbol/USD
value field names). Parsing in `parseWalletAssets()`/`parseFiatTotal()`
(`src/lib/sphereConnect.ts`) tries several commonly used field names as
reasonable guesses — if you find official details from Unicity Labs, or the
fields turn out to be different when tested against a real wallet, adjust
them there.

## Verification & posting quota

There are 3 paid verification tiers, purchased with UCT (sent to the
platform's treasury wallet using the same flow as sending a tip). You can
choose **monthly** or **yearly** billing — yearly gets a **15%** discount
compared to paying monthly x12. Buying a new tier always replaces the old
one (tiers don't stack). Pricing, quotas, character limits, and feature
config (images/editing) all live in one place: `src/lib/verification.ts`.

| Tier | UCT/month | UCT/year (15% off) | Badge | Posts/day | Max characters | Image attachments | Edit posts |
|---|---|---|---|---|---|---|---|
| Free (default, unpaid) | - | - | - | 1x | 100 | no | no |
| Verified | 30 | 306 | Blue check | 3x | 300 | no | no |
| Verified Pro | 50 | 510 | Gold check | 5x | 500 | yes | no |
| Verified Max | 100 | 1,020 | Indigo check | 10x | 1,000 | yes | yes |

Quotas reset every day at **00:00 UTC**. The "Get Verified" page (in the
sidebar/nav) has a Monthly/Yearly toggle, shows status (including the
subscription's renewal date), and a purchase button; the badge automatically
appears next to the username in the feed and profile once the purchase
succeeds. If a subscription's `expires_at` has passed, the tier is treated as
reverted to Free on the client side until it's renewed.

Before this feature can be used, set `VITE_VERIFICATION_TREASURY_WALLET` in
`.env.local` to the platform wallet address that receives the payments — see
`.env.example`.

**Security note ("rough around the edges")**: quota checks, character
limits, image/edit permissions, and recording the verification tier
(including billing expiry) are all done client-side (not via Supabase RLS or
on a server), same as the other protections in this project. Before
production, move this to a Postgres function/trigger + real on-chain
tx_hash verification, so it can't be bypassed by hitting Supabase directly.

## Setup

### 1. Create a Supabase project (if you don't have one)

Go to https://supabase.com and create a new (free) project.

### 2. Run the schema

Open **Supabase Dashboard → SQL Editor → New query**, paste the contents of
`supabase/schema.sql`, then **Run**. This creates 3 tables: `profiles`,
`posts`, `tips`, plus permissive RLS policies (anyone can read/write — fine
for the demo stage, **not yet safe for production**, see the notes inside
the schema file).

Then, in a **new query**, run `supabase/002_harden_writes.sql`. This moves
every write (posts, tips, follows, reposts, verifications) behind Postgres
functions (`create_post`, `send_tip`, `toggle_follow`, `toggle_repost`,
`purchase_verification`, ...) that re-check quotas, character limits,
pricing, ownership, and self-action rules **on the server**, then revokes
direct `insert`/`update`/`delete` on those tables from the client roles —
so hitting the Supabase REST API directly can no longer insert a fake
tip/follow/verification row or bypass a tier's daily quota. Read the
comment block at the top of that file for what this does and does **not**
yet cover (there's still no wallet-signature auth, so a caller can invoke
these functions claiming to be any wallet address — see the file for the
recommended next step).

### 3. Set environment variables

```bash
cp .env.example .env.local
```

Open **Supabase Dashboard → Project Settings → API**, copy the `Project URL`
and `anon public` key into `.env.local`.

### 4. Install & run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Click "Connect Wallet" — if you have the
Sphere extension, it'll be auto-detected (P2); otherwise a Sphere wallet
popup will open (P3) to approve the connection. Once connected, make a post,
then try tipping from another account (open a new browser tab / incognito
window, connect with a different wallet).

> Want to test iframe mode (P1)? Load this page inside Sphere as a Sphere
> Agent via `/agents/custom?url=http://localhost:5173`.

## Project structure

```
public/
  logo.png                    # brand mark, used for the app favicon and in-app logo
src/
  contexts/WalletContext.tsx   # Sphere Connect: identity, connect/disconnect, sendTip
  lib/sphereConnect.ts         # transport detection, identity/amount formatting, coinId resolver
  lib/verification.ts          # verification tier config: pricing, badges, daily posting quota
  hooks/useVerification.ts     # own wallet's tier status + purchase() (pays via sendTip)
  hooks/usePostQuota.ts        # computes the daily posting quota (resets at 00:00 UTC)
  components/
    ConnectWallet.tsx
    PostComposer.tsx
    Feed.tsx
    PostCard.tsx
    TipButton.tsx
    VerifiedBadge.tsx          # blue/gold/diamond check badge next to the username
    GetVerifiedPage.tsx        # page for purchasing/upgrading a verification tier
    icons.tsx                  # LogoMark renders public/logo.png as the brand mark
  supabaseClient.ts
  types.ts
supabase/schema.sql            # run this in the Supabase SQL Editor
```

## Roadmap (not yet built)

- Username / avatar (columns already exist in `profiles`, just needs UI)
- Likes, replies, follows
- Incoming tip notifications
- Stricter RLS policies (wallet signature verification)
#   m u s y a w a r a h  
 