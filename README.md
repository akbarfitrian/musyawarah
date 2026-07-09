# Musyawarah

A decentralized social platform built on wallet-based identity, inspired by the spirit of *musyawarah* (deliberation and consensus). Musyawarah enables open, transparent, and community-driven discussions — and, since v2.1, peer-to-peer hiring — powered by the Unicity network and the Sphere Wallet.

> **Status**: v2.1. Runs against Sphere's `testnet2` network.

---

## ✨ Features

- **Wallet Authentication** via Sphere — the app runs as a **Sphere Agent inside Sphere's own iframe** (`Connect` protocol v2.0, silent auto-connect on load). It does not run as a standalone site with an extension/popup fallback — see **Architecture notes** below.
- **Create & Browse Posts**, with images gated by verification tier
- **Tipping System** using UCT (Unicity Token), sent directly wallet-to-wallet
- **Repost** functionality with notifications
- **Subscription-based Verification** (Free → Verified → Verified Pro → Verified Max), billed monthly or yearly in UCT — see **Verification Tiers** below
- **Private Messaging** between wallets, including negotiation cards and offers (see **Marketplace** below)
- **Real-time Notifications** (follows, reposts, tips)
- **Quests & Achievements** — a 10-step, sequentially-unlocked quest line worth 14 points total
- **Top Tipped Leaderboard** — ranks both users and individual posts, weekly or all-time
- **User Search & Profiles** (bio, avatar upload, follower/following counts, provider rating)
- **Live Wallet Balance** in the sidebar's wallet dropdown — real portfolio value plus a per-token breakdown, refreshed on-demand and pushed live on incoming/confirmed transfers
- **Shareable URLs** — profiles, individual posts, and DM threads each have their own address (`#/profile/…`, `#/post/…`, `#/messages/…`) that can be copied, bookmarked, or opened directly, with working browser Back/Forward
- **Marketplace** — any post can double as a skill/agent-for-hire listing, negotiated and paid for entirely in-app, escrowed through a treasury wallet, and rated afterward — see **Marketplace** below
- **Light & Dark Mode**, monochrome black-and-white design system
- **Direct Monetization** through on-chain tipping, tiered subscriptions, and marketplace transactions

---

## 🛒 Marketplace

Any post can be published as a listing (title, category, price, and price mode — per-task or subscription) via the **"Post skill listing"** toggle in the composer. Listings show a price/category badge in the feed, and the Home feed has a dedicated **All / Listings** filter.

**End-to-end flow:**

1. **List** — a provider posts a listing; it appears in the feed and on their profile.
2. **Negotiate** — a buyer taps **"Negotiate & Hire"**, which opens a DM with the listing auto-attached as the first message. Either side can propose a price as an offer bubble (Accept/Decline).
3. **Order** — accepting an offer creates an order and posts an automatic status message in the same thread.
4. **Escrow** — the buyer locks payment to a treasury wallet (`lock_escrow_order`); the buyer confirms task completion (`confirm_order_complete`); the treasury operator releases the payout to the provider (`mark_order_released`) from the **Admin** page.
5. **Cancel** — either party can cancel an order while it's still `pending` (before anything is locked). Once locked, resolving a problem goes through manual dispute handling rather than a one-sided cancel. Re-negotiating and accepting a new offer automatically supersedes any stale pending order for the same pair.
6. **Review** — once an order is `released`, either party can leave a star rating and comment. Ratings aggregate into a reputation badge shown on the provider's profile.

All order state (`pending → locked → completed → released`, or `disputed` / `cancelled`) renders as a single status chip inline in the DM thread, with the relevant action button attached. A dedicated **Marketplace** page (`/marketplace`) offers two management tabs: **My Listings** (toggle active/inactive) and **My Orders** (grouped by status, linking back to the relevant thread).

**Trust model:** escrow is custodial, not trustless — the treasury wallet (the same one used for verification payments, `VITE_VERIFICATION_TREASURY_WALLET`) is the counterparty for the lock/release steps. Release is only ever performed from the Admin page by that wallet; every other party interacts through the negotiation/order flow above.

---

## 🧩 Built but not yet wired in

- **`src/components/AssetsPage.tsx`** — a full "Assets" view (live CoinGecko prices for BTC/ETH/SOL/USDC/USDT, pegged $1 pricing for the custom UCT/USDU tokens, holdings cross-referenced against those prices) is fully built but **not currently reachable from the UI**. There's no `'assets'` entry in `Sidebar`'s `View` type and no route for it in `App.tsx`. The wallet-balance summary users actually see today lives in the `ConnectWallet` dropdown instead, which shows total portfolio value + a "View assets" flyout using whatever `valueUsd` the wallet itself reports (no CoinGecko call there). Wiring `AssetsPage` into navigation (sidebar tab, or a page inside the wallet dropdown) is the natural next step.
---

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite (multi-page build: a static landing page at `/`, the actual dApp at `/app/`)
- **Styling**: Tailwind CSS, monochrome (pure black/white) design system driven by CSS variables
- **Backend**: Supabase (PostgreSQL, Row Level Security, `SECURITY DEFINER` RPC functions)
- **Wallet Integration**: [@unicitylabs/sphere-sdk](https://www.npmjs.com/package/@unicitylabs/sphere-sdk) (`Connect` protocol, iframe transport only)
- **Prices**: CoinGecko public API (no key), free-tier rate limits handled with backoff
- **Fonts**: Fraunces (display/serif headings) + Plus Jakarta Sans (body) + JetBrains Mono (addresses & token amounts)

---

## 📋 Prerequisites

- Node.js 20 or higher
- A Supabase project
- The Sphere Wallet — required, not optional. See **Architecture notes** below: this app only runs loaded inside Sphere, not as a standalone site.

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone <repository-url>
cd musyawarah
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Setup

Copy the example environment file:
```bash
cp .env.example .env.local
```

Fill in your credentials in `.env.local`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

VITE_SPHERE_WALLET_URL=https://sphere.unicity.network

# Optional: only needed if the app can't auto-resolve UCT's coinId from the
# connected wallet (see resolveUctCoin() in WalletContext.tsx)
# VITE_SPHERE_UCT_COIN_ID=

# Required for verification purchases AND marketplace escrow — this single
# wallet is the destination for tier payments and the custodian for locked
# order funds (see Marketplace above).
VITE_VERIFICATION_TREASURY_WALLET=@...
```

### 4. Run the development server
```bash
npm run dev
```

This is a **multi-page Vite build**: `/` serves a static marketing landing page (`index.html`), and `/app/` serves the actual React dApp (`app/index.html` → `src/main.tsx`). To actually use the app during development, load `/app/` **as a Sphere Agent** (e.g. via Sphere's `/agents/custom?url=http://localhost:5173/app/`) rather than opening it directly in a browser tab — see below.

### 5. Build for production
```bash
npm run build   # runs `tsc -b` then `vite build` — both pages land in one dist/
```

---

## 🧭 Architecture notes

The most important thing to know before touching `WalletContext.tsx`: **Musyawarah only supports running as a Sphere Agent loaded inside Sphere's own iframe.** Earlier iterations supported an extension mode and a popup mode as fallbacks (the `SphereConnectionMode` type still lists `'iframe' | 'extension' | 'popup'`, and `.env.example` still has a leftover comment about popup mode); both were deliberately dropped since this dApp doesn't need to run standalone in a normal browser tab. In practice, opening the app outside of Sphere just leaves it stuck on the "Connect Wallet" screen — `connect()` will fail because there's no parent frame to hand off to.

Practical implications:
- Local development needs Sphere itself running (or pointed at) so it can load your `localhost:5173/app/` build as a custom agent.
- `ConnectClient` requires the `network` field on every handshake (Connect protocol v2.0) — this is hardcoded to `SPHERE_NETWORKS.testnet2`, since that's the only network Sphere currently runs.
- UCT's on-chain `coinId` isn't published anywhere stable, so `resolveUctCoin()` queries the connected wallet at runtime (`sphere_getAssets` → `sphere_getTokens` → `VITE_SPHERE_UCT_COIN_ID` env override, in that order) rather than hardcoding it.
- **Transfer confirmations aren't EVM-style.** Sphere/Unicity doesn't always return a conventional "tx hash" from a `send` intent — depending on wallet version it may return `transferId`, `transfer.id`, `tx.id`, `tokenId`, or similar. `sendTip()` checks all of these and, if none are present, falls back to a client-generated identifier rather than throwing — throwing at that point would be reporting a successful transfer as a failure, prompting the user to (incorrectly) retry and send funds twice.

---

## 📁 Project Structure

```
├── index.html               # static marketing landing page (served at "/")
├── app/index.html            # dApp entry point (served at "/app/")
├── src/
│   ├── components/           # UI components (pages + reusable widgets)
│   ├── config/                # Static config (listing categories, …)
│   ├── contexts/              # WalletContext, ProfileContext, ThemeContext
│   ├── hooks/                 # Data hooks (posts, messages, notifications,
│   │                          #   quests, follows, verification, orders,
│   │                          #   reviews, routing, asset prices, leaderboards…)
│   ├── lib/                   # Core logic: sphereConnect, verification tier
│   │                          #   config, avatar/post-image upload, notify helpers
│   ├── utils/                  # Small helpers (avatar colors, linkify, time,
│   │                          #   composer focus, hash-based routing)
│   ├── types.ts                # Shared TypeScript types for the whole data model
│   ├── supabaseClient.ts
│   └── main.tsx
└── supabase/                  # Plain numbered SQL migrations, no CLI/migrations tooling wired up
    ├── schema.sql               # base tables + initial (permissive) RLS policies
    ├── 002_harden_writes.sql    # SECURITY DEFINER RPCs for posts/follows/reposts/tips/verification
    ├── 003_quests.sql           # quests + user_quest_progress tables, re-wraps the RPCs above
    │                            #   with quest-completion triggers, adds get_quest_board()
    ├── 004_top_tipped.sql       # get_top_tipped() — user leaderboard RPC
    ├── 005_top_tipped_posts.sql # get_top_tipped_posts() — trending posts RPC
    ├── 006_marketplace_listings.sql    # listing columns on posts; create_post() redefined
    │                                   #   again to accept them
    ├── 007_marketplace_negotiation.sql # messages.kind/payload, `orders` table (pending
    │                                   #   only), send_message/propose_offer/accept_offer/
    │                                   #   decline_offer/mark_thread_read RPCs — closes the
    │                                   #   `messages` RLS gap
    ├── 008_marketplace_escrow_rpc.sql  # lock_escrow_order/confirm_order_complete/
    │                                   #   mark_order_released RPCs
    ├── 009_marketplace_reviews.sql     # `reviews` table, submit_review(),
    │                                   #   get_provider_reputation(), set_listing_active()
    ├── 010_fix_treasury_wallet.sql     # fixes a bad treasury-wallet constant from 008
    └── 011_cancel_and_supersede_orders.sql # cancel_order() + auto-supersede stale
                                            #   pending orders on re-negotiation
```

Run the SQL files against your Supabase project **in numeric order**, `schema.sql` through `011` — later files redefine some functions from earlier ones (e.g. `create_post` is redefined in `003_quests.sql` to record quest progress, then again in `006_marketplace_listings.sql` to accept listing fields, carrying the quest-award logic forward).

---

## 🔐 Security Model

Every write goes through **Supabase RPC functions** (`SECURITY DEFINER`):

- `create_post` / `edit_post` / `delete_post` — enforce tier-based character limits, daily post quotas, image-attachment permission, edit permission (Verified Max only), and listing-field validation (title/category/price required + price mode) server-side
- `toggle_follow`, `toggle_repost`, `send_tip` — atomic, ownership-checked
- `purchase_verification` — recomputes the price from `TIER_CONFIG` server-side (never trusts the client's number) and rejects a `tx_hash` that's already been used
- `award_quest`, `record_wallet_connect`, `get_quest_board` — quest progress bookkeeping
- `get_top_tipped`, `get_top_tipped_posts` — leaderboard reads
- `send_message`, `propose_offer`, `accept_offer`, `decline_offer`, `mark_thread_read` — direct-message writes, listing/offer cards attached to a thread, and the buyer/provider negotiation flow. `accept_offer` can only be called by the offer's recipient (not the proposer) and creates a `pending` row in `orders` plus an automatic `order_update` system message in the same thread.
- `lock_escrow_order`, `confirm_order_complete`, `mark_order_released`, `cancel_order` — the escrow lifecycle. `mark_order_released` is validated server-side against the treasury wallet regardless of what the client claims; the Admin-page guard is a UX convenience, not the security boundary.
- `submit_review`, `get_provider_reputation`, `set_listing_active` — reviews and listing management

**The `messages` table has no client-side write path anymore.** As of `007_marketplace_negotiation.sql`, direct `insert`/`update` privileges on `messages` were revoked from `anon`/`authenticated`, closing what had been the one unhardened write in the app. The `orders` and `reviews` tables introduced afterward follow the same rule from the start: reads are public, writes are RPC-only.

---

## 🏷️ Verification Tiers

Single source of truth is `TIER_CONFIG` in `src/lib/verification.ts` — everything below reads from there.

| Tier            | Badge          | Price (monthly) | Daily Posts | Max Length | Images | Editing |
|-----------------|----------------|------------------|-------------|------------|--------|---------|
| Free            | None           | Free             | 1           | 60 chars   | No     | No      |
| Verified        | Blue check     | 30 UCT           | 2           | 150 chars  | No     | No      |
| Verified Pro    | Gold check     | 50 UCT           | 2           | 250 chars  | Yes    | No      |
| Verified Max    | Indigo check   | 100 UCT          | 3           | 350 chars  | Yes    | Yes     |

- **Billing is a real subscription**, not one-time: monthly or yearly, paid in UCT via the same `sendTip()` flow used for regular tips (destination is `VITE_VERIFICATION_TREASURY_WALLET` instead of a post author). Yearly plans are billed once for 12 months at a **15% discount** vs. paying monthly × 12.
- Tiers **don't stack** — buying a new tier always overwrites the current one (upgrade or downgrade), it never adds on top.
- Daily post quotas reset at 00:00 UTC. Note that even the top tier (Verified Max) has a **daily cap of 3**, not unlimited.
- Subscriptions aren't auto-renewed on-chain: once `expires_at` passes, the client treats the tier as reverted to `none` (the DB row itself isn't deleted).

---

## 🏆 Quests & Achievements

A 10-quest, **sequentially unlocked** progression (`src/components/QuestsPage.tsx`, `src/hooks/useQuests.ts`, backed by `get_quest_board()` in `003_quests.sql`) — each quest stays locked until the previous one is completed. 7 easy quests (1 point each) + 2 medium (2 points each) + 1 hard (3 points) = **14 points max**:

1. Connect Sphere Wallet
2. Complete Your Profile (avatar + bio)
3. Send Your First Post
4. Follow 3 Users
5. Send Your First Tip (UCT)
6. Upgrade to Verified Max
7. Post With an Image
8. Edit Your First Post
9. Post 5 Days in a Row (UTC streak)
10. Receive 10 Tips From Others (cumulative)

Progress is recorded server-side inside the relevant RPC (e.g. `create_post`, `send_tip`, `purchase_verification`) or via a Postgres trigger (profile completion) — there's no external webhook or separate backend involved.

---

## 📈 Top Tipped Leaderboard

The right-hand panel (`RightPanel.tsx`) shows a "Top Tipped" widget with two sub-tabs:

- **Users** — wallets ranked by total UCT tips received (`get_top_tipped`)
- **Trending** — individual posts ranked by total UCT tips received (`get_top_tipped_posts`), clicking a row jumps to that post's permalink and briefly highlights it

Both support a **weekly** (resets Monday 00:00 UTC) and **all-time** period toggle.

---

## 🎨 Design

- **Monochrome, pure black & white** — light mode is black-on-white, dark mode is white-on-black; both read from CSS variables in `src/index.css` and are exact mirror images of each other. The fixed, theme-independent colors in the UI are a blue dot/badge reserved for unread-message notifications, gold for tipping/money/marketplace pricing, and red for destructive/error states.
- **Fraunces** (a warm, slightly characterful serif) for the wordmark and section headings, used sparingly via `font-display`
- **Plus Jakarta Sans** for body text — chosen partly as a nod to where "musyawarah" comes from
- **JetBrains Mono** for wallet addresses and token amounts
- First-class light **and** dark mode, persisted to `localStorage` and defaulting to the OS's `prefers-color-scheme` on first visit

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a pull request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT — see [`LICENSE`](./LICENSE).

---

## 🌍 About Musyawarah

**Musyawarah** is a social platform that brings the traditional values of deliberation, respect, and consensus into the digital age using wallet-based identity and transparent on-chain interactions.

Built for the Unicity & Sphere ecosystem.
