# Musyawarah

A decentralized social platform built on wallet-based identity, implemented on top of the **Sphere Wallet** and the **Unicity network**. Musyawarah takes its name from *musyawarah*, the Indonesian tradition of deliberation and consensus, and applies it to open, transparent, community-driven discussion and peer-to-peer hiring.

> **Status**: v2.2, running against Sphere's `testnet2` network.

---

## Sphere and Unicity Integration

Musyawarah is not a standalone web app with wallet support bolted on — it is built to run as a **Sphere Agent inside Sphere's own iframe**, authenticating and transacting through the Unicity network from the ground up.

- **Identity**: wallets are the only identity layer. There is no separate account system, password, or email — a connected Sphere wallet address is the user.
- **Connect protocol v2.0**: the app performs a silent auto-connect on load via `ConnectClient`, with `network` set to `SPHERE_NETWORKS.testnet2` on every handshake, since that is the only network Sphere currently runs.
- **Transport**: iframe-only. Earlier iterations supported extension and popup fallbacks (the `SphereConnectionMode` type still lists `'iframe' | 'extension' | 'popup'`), but both were deliberately dropped. The app does not run standalone in a normal browser tab — opening it outside Sphere leaves it on the "Connect Wallet" screen, since `connect()` has no parent frame to hand off to.
- **UCT (Unicity Token)**: the native currency for every value transfer in the app — tips, verification billing, and marketplace payments. UCT's on-chain `coinId` is not published anywhere stable, so `resolveUctCoin()` queries the connected wallet at runtime (`sphere_getAssets` → `sphere_getTokens` → an optional `VITE_SPHERE_UCT_COIN_ID` override), rather than hardcoding it.
- **Transfer confirmation handling**: Sphere/Unicity does not always return a conventional transaction hash from a `send` intent. Depending on wallet version it may return `transferId`, `transfer.id`, `tx.id`, `tokenId`, or similar. `sendTip()` checks all of these and falls back to a client-generated identifier rather than throwing, since throwing at that point would report a successful transfer as a failure and risk a duplicate send.
- **Live wallet balance**: the sidebar's wallet dropdown reads portfolio value and per-token balances directly from the connected wallet, refreshed on demand and pushed live on incoming or confirmed transfers.

Local development requires Sphere itself running (or reachable) so it can load `localhost:5173/app/` as a custom agent — see **Getting Started** below.

---

## Features

- **Wallet authentication** via Sphere, described above
- **Create and browse posts**, with image attachments gated by verification tier
- **Tipping** in UCT, sent directly wallet-to-wallet
- **Repost** with notifications
- **Subscription-based verification** (Free, Verified, Verified Pro, Verified Max), billed monthly or yearly in UCT — see **Verification Tiers**
- **Private messaging** between wallets, including negotiation cards and offers — see **Marketplace**
- **Real-time notifications** for follows, reposts, and tips
- **Quests and achievements**, a 10-step sequential quest line worth 14 points
- **Top Tipped leaderboard**, ranking both users and individual posts, weekly or all-time
- **User search and profiles**, with bio, avatar, follower/following counts, and provider rating
- **Shareable URLs** for profiles, posts, and DM threads (`#/profile/…`, `#/post/…`, `#/messages/…`), with working browser back/forward
- **Marketplace**, where any post can double as a skill or agent-for-hire listing — see **Marketplace**
- **Light and dark mode**, monochrome black-and-white design system
- **Monetization** through on-chain tipping, tiered subscriptions, and marketplace transactions

---

## Marketplace

Any post can be published as a listing (title, category, price, and price mode — per-task or subscription) through the "Post skill listing" toggle in the composer. Listings show a price and category badge in the feed, and the Home feed has an All / Listings filter.

**Flow:**

1. **List** — a provider posts a listing, visible in the feed and on their profile.
2. **Negotiate** — a buyer selects "Negotiate & Hire", opening a DM with the listing attached as the first message. Either side can propose a price as an offer.
3. **Order** — accepting an offer creates an order and posts an automatic status message in the same thread.
4. **Escrow** — the buyer locks payment to a treasury wallet (`lock_escrow_order`), confirms task completion (`confirm_order_complete`), and the treasury operator releases payout to the provider (`mark_order_released`) from the Admin page.
5. **Cancel** — either party can cancel an order while it is still `pending`, before anything is locked. Once locked, resolving a problem goes through manual dispute handling rather than a one-sided cancel. Accepting a new offer automatically supersedes any stale pending order for the same pair.
6. **Review** — once an order is `released`, either party can leave a star rating and comment, aggregated into a reputation badge on the provider's profile.

Order status (`pending → locked → completed → released`, or `disputed` / `cancelled`) renders as a status chip inline in the DM thread, with the relevant action attached. A dedicated Marketplace page (`/marketplace`) provides two tabs: My Listings and My Orders.

Escrow is custodial, not trustless. The treasury wallet (the same wallet used for verification payments, `VITE_VERIFICATION_TREASURY_WALLET`) is the counterparty for lock and release. Release is only ever performed from the Admin page by that wallet.

---

## Built but Not Yet Wired In

`src/components/AssetsPage.tsx` implements a full Assets view — live CoinGecko prices for BTC, ETH, SOL, USDC, and USDT, pegged $1 pricing for UCT/USDU, and holdings cross-referenced against those prices — but is not currently reachable from the UI. There is no `'assets'` entry in `Sidebar`'s `View` type and no route for it in `App.tsx`. The wallet balance summary users see today lives in the `ConnectWallet` dropdown instead, using the `valueUsd` the wallet itself reports, without a CoinGecko call. Wiring `AssetsPage` into navigation is the natural next step.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite (multi-page build — a static landing page at `/`, the dApp at `/app/`)
- **Styling**: Tailwind CSS, monochrome design system driven by CSS variables
- **Backend**: Supabase (PostgreSQL, Row Level Security, `SECURITY DEFINER` RPC functions)
- **Wallet integration**: [@unicitylabs/sphere-sdk](https://www.npmjs.com/package/@unicitylabs/sphere-sdk), Connect protocol, iframe transport only
- **Prices**: CoinGecko public API, free-tier rate limits handled with backoff
- **Fonts**: Fraunces for display headings, Plus Jakarta Sans for body text, JetBrains Mono for addresses and token amounts

---

## Prerequisites

- Node.js 20 or higher
- A Supabase project
- The Sphere Wallet — required. This app only runs loaded inside Sphere, not as a standalone site (see **Sphere and Unicity Integration** above).

---

## Getting Started

### 1. Clone the repository
```bash
git clone <repository-url>
cd musyawarah
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment setup

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

# Required for verification purchases and marketplace escrow. This wallet is
# the destination for tier payments and the custodian for locked order funds
# (see Marketplace above).
VITE_VERIFICATION_TREASURY_WALLET=@...
```

### 4. Run the development server
```bash
npm run dev
```

This is a multi-page Vite build: `/` serves a static landing page (`index.html`), and `/app/` serves the React dApp (`app/index.html` → `src/main.tsx`). To use the app during development, load `/app/` as a Sphere Agent (for example via Sphere's `/agents/custom?url=http://localhost:5173/app/`) rather than opening it directly in a browser tab.

### 5. Build for production
```bash
npm run build   # runs `tsc -b` then `vite build`; both pages land in one dist/
```

---

## Project Structure

```
├── index.html                 # static landing page, served at "/"
├── app/index.html              # dApp entry point, served at "/app/"
├── src/
│   ├── components/             # UI components (pages and reusable widgets)
│   ├── config/                 # static config (listing categories, ...)
│   ├── contexts/               # WalletContext, ProfileContext, ThemeContext
│   ├── hooks/                  # data hooks (posts, messages, notifications,
│   │                            #   quests, follows, verification, orders,
│   │                            #   reviews, routing, asset prices, leaderboards)
│   ├── lib/                    # core logic: sphereConnect, verification tier
│   │                            #   config, avatar/post-image upload, notify helpers
│   ├── utils/                  # helpers (avatar colors, linkify, time,
│   │                            #   composer focus, hash-based routing)
│   ├── types.ts                # shared TypeScript types for the data model
│   ├── supabaseClient.ts
│   └── main.tsx
└── supabase/                   # plain numbered SQL migrations, no CLI tooling
    ├── schema.sql               # base tables and initial RLS policies
    ├── 002_harden_writes.sql    # SECURITY DEFINER RPCs for posts/follows/reposts/tips/verification
    ├── 003_quests.sql           # quests + user_quest_progress tables, re-wraps the RPCs above
    │                            #   with quest-completion triggers, adds get_quest_board()
    ├── 004_top_tipped.sql       # get_top_tipped() user leaderboard RPC
    ├── 005_top_tipped_posts.sql # get_top_tipped_posts() trending posts RPC
    ├── 006_marketplace_listings.sql    # listing columns on posts; create_post() redefined
    │                                   #   to accept them
    ├── 007_marketplace_negotiation.sql # messages.kind/payload, orders table (pending
    │                                   #   only), send_message/propose_offer/accept_offer/
    │                                   #   decline_offer/mark_thread_read RPCs
    ├── 008_marketplace_escrow_rpc.sql  # lock_escrow_order/confirm_order_complete/
    │                                   #   mark_order_released RPCs
    ├── 009_marketplace_reviews.sql     # reviews table, submit_review(),
    │                                   #   get_provider_reputation(), set_listing_active()
    ├── 010_fix_treasury_wallet.sql     # fixes a bad treasury-wallet constant from 008
    └── 011_cancel_and_supersede_orders.sql # cancel_order() and auto-supersede of stale
                                             #   pending orders on re-negotiation
```

Run the SQL files against your Supabase project in numeric order, `schema.sql` through `011`. Later files redefine some functions from earlier ones — for example, `create_post` is redefined in `003_quests.sql` to record quest progress, then again in `006_marketplace_listings.sql` to accept listing fields, carrying the quest-award logic forward.

---

## Security Model

Every write goes through Supabase RPC functions (`SECURITY DEFINER`):

- `create_post` / `edit_post` / `delete_post` — enforce tier-based character limits, daily post quotas, image-attachment permission, edit permission (Verified Max only), and listing-field validation server-side
- `toggle_follow`, `toggle_repost`, `send_tip` — atomic, ownership-checked
- `purchase_verification` — recomputes price from `TIER_CONFIG` server-side and rejects a `tx_hash` that has already been used
- `award_quest`, `record_wallet_connect`, `get_quest_board` — quest progress bookkeeping
- `get_top_tipped`, `get_top_tipped_posts` — leaderboard reads
- `send_message`, `propose_offer`, `accept_offer`, `decline_offer`, `mark_thread_read` — direct-message writes and the buyer/provider negotiation flow. `accept_offer` can only be called by the offer's recipient and creates a `pending` row in `orders` with an automatic system message in the same thread.
- `lock_escrow_order`, `confirm_order_complete`, `mark_order_released`, `cancel_order` — the escrow lifecycle. `mark_order_released` is validated server-side against the treasury wallet regardless of what the client claims; the Admin-page guard is a UX convenience, not the security boundary.
- `submit_review`, `get_provider_reputation`, `set_listing_active` — reviews and listing management

The `messages` table has no client-side write path. As of `007_marketplace_negotiation.sql`, direct insert/update privileges on `messages` were revoked from `anon`/`authenticated`. The `orders` and `reviews` tables introduced afterward follow the same rule from the start: reads are public, writes are RPC-only.

---

## Verification Tiers

The single source of truth is `TIER_CONFIG` in `src/lib/verification.ts`.

| Tier          | Badge        | Price (monthly) | Daily Posts | Max Length | Images | Editing |
|---------------|--------------|------------------|-------------|------------|--------|---------|
| Free          | None         | Free             | 1           | 60 chars   | No     | No      |
| Verified      | Blue check   | 30 UCT           | 2           | 150 chars  | No     | No      |
| Verified Pro  | Gold check   | 50 UCT           | 2           | 250 chars  | Yes    | No      |
| Verified Max  | Indigo check | 100 UCT          | 3           | 350 chars  | Yes    | Yes     |

- Billing is a real subscription, monthly or yearly, paid in UCT through the same `sendTip()` flow used for regular tips, with `VITE_VERIFICATION_TREASURY_WALLET` as the destination instead of a post author. Yearly plans are billed once for 12 months at a 15% discount versus paying monthly.
- Tiers do not stack — buying a new tier always overwrites the current one, upgrade or downgrade.
- Daily post quotas reset at 00:00 UTC. Even Verified Max has a daily cap of 3.
- Subscriptions are not auto-renewed on-chain. Once `expires_at` passes, the client treats the tier as reverted to `none`; the database row is not deleted.

---

## Quests and Achievements

A 10-quest, sequentially unlocked progression (`src/components/QuestsPage.tsx`, `src/hooks/useQuests.ts`, backed by `get_quest_board()` in `003_quests.sql`) — each quest stays locked until the previous one is completed. Seven easy quests (1 point each), two medium (2 points each), and one hard (3 points) total 14 points:

1. Connect Sphere Wallet
2. Complete Your Profile (avatar and bio)
3. Send Your First Post
4. Follow 3 Users
5. Send Your First Tip (UCT)
6. Upgrade to Verified Max
7. Post With an Image
8. Edit Your First Post
9. Post 5 Days in a Row (UTC streak)
10. Receive 10 Tips From Others (cumulative)

Progress is recorded server-side inside the relevant RPC (`create_post`, `send_tip`, `purchase_verification`) or via a Postgres trigger for profile completion — there is no external webhook or separate backend involved.

---

## Top Tipped Leaderboard

The right-hand panel (`RightPanel.tsx`) shows a Top Tipped widget with two tabs:

- **Users** — wallets ranked by total UCT tips received (`get_top_tipped`)
- **Trending** — individual posts ranked by total UCT tips received (`get_top_tipped_posts`); selecting a row jumps to that post's permalink and briefly highlights it

Both support a weekly (resets Monday 00:00 UTC) and all-time period toggle.

---

## Design

- Monochrome, pure black and white — light mode is black-on-white, dark mode is white-on-black, both read from CSS variables in `src/index.css` as exact mirror images of each other. The fixed, theme-independent colors are a blue indicator for unread messages, gold for tipping and marketplace pricing, and red for destructive or error states.
- Fraunces, a warm serif, for the wordmark and section headings, used sparingly
- Plus Jakarta Sans for body text
- JetBrains Mono for wallet addresses and token amounts
- Light and dark mode, persisted to `localStorage` and defaulting to the OS `prefers-color-scheme` on first visit

---

## Contributing

Contributions are welcome.

1. Fork the project
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a pull request

---

## License

MIT — see [`LICENSE`](./LICENSE).

---

## About Musyawarah

Musyawarah is a social platform built on wallet-based identity and on-chain interaction through Sphere and the Unicity network, bringing deliberation, respect, and consensus into a decentralized, transparent format.