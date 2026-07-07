# Musyawarah

A decentralized social platform built on wallet-based identity, inspired by the spirit of *musyawarah* (deliberation and consensus). Musyawarah enables open, transparent, and community-driven discussions powered by the Unicity network and the Sphere Wallet.

> **Status**: v0.2, actively evolving ("ala kadarnya" build philosophy — ship the rough version, refine later). Runs against Sphere's `testnet2` network.

---

## ✨ Features

- **Wallet Authentication** via Sphere — the app runs as a **Sphere Agent inside Sphere's own iframe** (`Connect` protocol v2.0, silent auto-connect on load). It does not run as a standalone site with an extension/popup fallback — see **Architecture notes** below.
- **Create & Browse Posts**, with images gated by verification tier
- **Tipping System** using UCT (Unicity Token), sent directly wallet-to-wallet
- **Repost** functionality with notifications
- **Subscription-based Verification** (Free → Verified → Verified Pro → Verified Max), billed monthly or yearly in UCT — see **Verification Tiers** below
- **Private Messaging** between wallets
- **Real-time Notifications** (follows, reposts, tips)
- **Quests & Achievements** — a 10-step, sequentially-unlocked quest line worth 14 points total
- **Top Tipped Leaderboard** — ranks both users and individual posts, weekly or all-time
- **User Search & Profiles** (bio, avatar upload, follower/following counts)
- **Live Wallet Balance** in the sidebar's wallet dropdown — real portfolio value plus a per-token breakdown, refreshed on-demand and pushed live on incoming/confirmed transfers
- **Light & Dark Mode**, monochrome black-and-white design system
- **Direct Monetization** through on-chain tipping and tiered subscriptions

---

## 🧩 Built but not yet wired in

Being upfront about the current loose ends rather than describing the aspirational version:

- **`src/components/AssetsPage.tsx`** — a full "Assets" view (live CoinGecko prices for BTC/ETH/SOL/USDC/USDT, pegged $1 pricing for the custom UCT/USDU tokens, holdings cross-referenced against those prices) is fully built but **not currently reachable from the UI**. There's no `'assets'` entry in `Sidebar`'s `View` type and no route for it in `App.tsx`. The wallet-balance summary users actually see today lives in the `ConnectWallet` dropdown instead, which shows total portfolio value + a "View assets" flyout using whatever `valueUsd` the wallet itself reports (no CoinGecko call there). Wiring `AssetsPage` into navigation (sidebar tab, or a page inside the wallet dropdown) is the natural next step.
- **Direct messages bypass the RPC-hardening pattern.** Every other write (posts, follows, reposts, tips, verification purchases) goes through a `SECURITY DEFINER` RPC. Messages, by contrast, are inserted/updated directly against the `messages` table from the client, and its RLS policies are currently permissive (`using (true)` for insert/update) — there's no server-side check that the sender is who they claim to be. Fine for a testnet demo, worth hardening before anything resembling production use.
- **No `LICENSE` file is actually included in this repo yet**, despite the license section below — add one before treating the MIT mention as binding.

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

# Required for verification purchases to work (destination wallet for tier payments)
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

---

## 📁 Project Structure

```
├── index.html            # static marketing landing page (served at "/")
├── app/index.html         # dApp entry point (served at "/app/")
├── src/
│   ├── components/        # UI components (pages + reusable widgets)
│   ├── contexts/           # WalletContext, ProfileContext, ThemeContext
│   ├── hooks/              # Data hooks (posts, messages, notifications, quests,
│   │                       #   follows, verification, asset prices, leaderboards…)
│   ├── lib/                # Core logic: sphereConnect, verification tier config,
│   │                       #   avatar/post-image upload, notify helpers
│   ├── utils/               # Small helpers (avatar colors, linkify, time, composer focus)
│   ├── types.ts             # Shared TypeScript types for the whole data model
│   ├── supabaseClient.ts
│   └── main.tsx
└── supabase/               # Plain numbered SQL migrations, no CLI/migrations tooling wired up
    ├── schema.sql            # base tables + initial (permissive) RLS policies
    ├── 002_harden_writes.sql # SECURITY DEFINER RPCs for posts/follows/reposts/tips/verification
    ├── 003_quests.sql        # quests + user_quest_progress tables, re-wraps the RPCs above
    │                         #   with quest-completion triggers, adds get_quest_board()
    ├── 004_top_tipped.sql    # get_top_tipped() — user leaderboard RPC
    └── 005_top_tipped_posts.sql # get_top_tipped_posts() — trending posts RPC
```

Run the SQL files against your Supabase project **in numeric order** (`schema.sql` → `002` → `003` → `004` → `005`) — later files redefine some functions from earlier ones (e.g. `create_post` is redefined in `003_quests.sql` to also record quest progress).

---

## 🔐 Security Model

Most writes go through **Supabase RPC functions** (`SECURITY DEFINER`), defined in `002_harden_writes.sql` and `003_quests.sql`:

- `create_post` / `edit_post` / `delete_post` — enforce tier-based character limits, daily post quotas, image-attachment permission, and edit permission (Verified Max only) server-side
- `toggle_follow`, `toggle_repost`, `send_tip` — atomic, ownership-checked
- `purchase_verification` — recomputes the price from `TIER_CONFIG` server-side (never trusts the client's number) and rejects a `tx_hash` that's already been used
- `award_quest`, `record_wallet_connect`, `get_quest_board` — quest progress bookkeeping
- `get_top_tipped`, `get_top_tipped_posts` — leaderboard reads

**One exception:** the `messages` table is written to directly from the client (`supabase.from('messages').insert(...)` / `.update(...)`), not through an RPC, and its RLS policies currently allow any insert/update (`using (true)`). See **Built but not yet wired in** above — this is a known gap, not an oversight to copy elsewhere.

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
- **Trending** — individual posts ranked by total UCT tips received (`get_top_tipped_posts`), clicking a row jumps to that post on the author's profile and briefly highlights it

Both support a **weekly** (resets Monday 00:00 UTC) and **all-time** period toggle.

---

## 🎨 Design

- **Monochrome, pure black & white** — light mode is black-on-white, dark mode is white-on-black; both read from CSS variables in `src/index.css` and are exact mirror images of each other. The only fixed, theme-independent colors in the whole UI are a blue dot/badge reserved for unread-message notifications, gold for tipping/money, and red for destructive/error states.
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

Intended to be MIT-licensed, but **no `LICENSE` file is committed yet** — add one before relying on this section.

---

## 🌍 About Musyawarah

**Musyawarah** is a social platform that brings the traditional values of deliberation, respect, and consensus into the digital age using wallet-based identity and transparent on-chain interactions.

Built with ❤️ for the Unicity & Sphere ecosystem.
