# Musyawarah

A decentralized social platform built on wallet-based identity, implemented on top of the **Sphere Wallet** and the **Unicity network**. Musyawarah takes its name from *musyawarah*, the Indonesian tradition of deliberation and consensus, and applies it to open, transparent, community-driven discussion and peer-to-peer hiring.

> **Status**: v2.4.1, running against Sphere's `testnet2` network. See [`CHANGELOG.md`](./CHANGELOG.md) for release history.

---

## Sphere and Unicity Integration

Musyawarah is not a standalone web app with wallet support bolted on — it is built to run as a **Sphere Agent inside Sphere's own iframe**, authenticating and transacting through the Unicity network from the ground up.

- **Identity**: wallets are the only identity layer. There is no separate account system, password, or email — a connected Sphere wallet address is the user.
- **Connect protocol v2.0**: the app performs a silent auto-connect on load via `ConnectClient`, with `network` set to `SPHERE_NETWORKS.testnet2` on every handshake, since that is the only network Sphere currently runs.
- **Transport**: iframe-only. Earlier iterations supported extension and popup fallbacks (the `SphereConnectionMode` type still lists `'iframe' | 'extension' | 'popup'`), but both were deliberately dropped. The app does not run standalone in a normal browser tab — opening it outside Sphere leaves it on the "Connect Wallet" screen, since `connect()` has no parent frame to hand off to.
- **UCT (Unicity Token)**: the native currency for every value transfer in the app — tips, verification billing, and marketplace payments. UCT's on-chain `coinId` is not published anywhere stable, so `resolveUctCoin()` queries the connected wallet at runtime (`sphere_getAssets` → `sphere_getTokens` → an optional `VITE_SPHERE_UCT_COIN_ID` override), rather than hardcoding it. Every candidate coinId is validated with `isValidHexCoinId()` (even-length lowercase hex) before it's trusted; a malformed value from the wallet is discarded with a console warning instead of being used as-is, and if no valid coinId can be resolved at all — from the wallet or from `VITE_SPHERE_UCT_COIN_ID` — `resolveUctCoin()` throws a descriptive error rather than silently falling back to the literal string `"UCT"`.
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
- **Private messaging** between wallets, including negotiation cards and offers — see **Marketplace** — with sender-side deletion (soft delete, text messages only; leaves a "Message deleted" placeholder rather than erasing the row)
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

Any post can be published as a listing (title, category, price, and price mode — per-task or subscription) through the "Post skill listing" toggle in the composer. Listings show a price and category badge in the feed, and the Home feed has an All / Listings filter. Listings also carry `order_count` and `completed_order_count`: the former permanently blocks deletion once any order (even a cancelled one) has referenced the post, since `orders.post_id` has an `on delete restrict` foreign key; the latter drives a "X sold" badge on the listing card.

**Flow:**

1. **List** — a provider posts a listing, visible in the feed and on their profile. Deactivating a listing (`set_listing_active`) is enforced server-side against new offers too, not just hidden client-side — a deactivated listing can't receive fresh offers even if its card is still sitting in an old DM thread.
2. **Negotiate** — a buyer selects "Negotiate & Hire", opening a DM with the listing attached as the first message. Either side can propose a price as an offer. An offer left unanswered for **3 hours** is auto-declined, with a system message explaining it expired rather than was rejected.
3. **Order** — accepting an offer creates an order and posts an automatic status message in the same thread. Accepting a new offer automatically supersedes any stale pending order for the same pair.
4. **Escrow** — locking payment is a two-phase handoff between the database and the on-chain transfer, not a single step. The buyer first reserves the order server-side (`begin_escrow_lock`), which moves it to a transient `locking` status and stamps `locking_at`; only then does the client send the actual on-chain tip to the treasury wallet. If that transfer fails or is rejected in the wallet, the client immediately releases the reservation (`abort_escrow_lock`), returning the order to `pending` so the buyer can retry cleanly instead of the order getting stuck mid-lock. Any order left in `locking` for more than **15 minutes** — e.g. the buyer closed the tab mid-transfer — is automatically reverted to `pending` by a scheduled function (see **Marketplace automation** below). Once the transfer succeeds, `lock_escrow_order` moves the order to `locked`. Starting **1 hour** after lock, and every **6 hours** after that, both buyer and provider get a reminder notification with the order's details, until either side moves the order along or 24 hours pass.
5. **Deliver** — the provider marks the order delivered with a link to the finished work (Google Drive, GitHub, Figma, etc. — the platform has no file storage of its own, so delivery is always a URL). This can only happen once per order at this step; `confirm_order_complete` is gated behind it, so the buyer's "Confirm task complete" button doesn't activate until a deliverable link exists.
6. **Confirm, dispute, or drift** — once a deliverable link is posted, the buyer has three paths:
   - **Confirm** — `confirm_order_complete` moves the order to `completed`, same as before.
   - **Dispute** — the buyer can reject the delivered work with a required reason (`dispute_order`), moving the order to `disputed`. This is a **one-time** right per order (`dispute_used`) — once spent, the "Dispute" button disappears permanently even if the order returns to `locked`. The provider can respond with `submit_deliverable_revision`, posting a new link that reopens the order as `locked` and restarts its clocks.
   - **Do nothing** — if the buyer never confirms, the order is auto-completed **72 hours** after delivery (`completion_reason: 'buyer_no_confirm_72h'`), the same effect as a manual confirm.

   Separately, if the provider never delivers at all, the order is auto-flagged `disputed` **24 hours** after lock (`dispute_reason: 'seller_no_delivery_24h'`). The provider can still answer with `submit_deliverable_revision` at any point while `disputed`. If they don't, **24 hours after that** (48 hours after lock in total) the order is auto-flagged refund-eligible (`refund_flagged_at`), and an operator can then call `mark_order_refunded` — refusing to run unless that flag is set — to record the refund once they've sent the escrowed funds back to the buyer.

   The treasury operator releases payout to the provider (`mark_order_released`) from the Admin page once an order is `completed`, or refunds the buyer (`mark_order_refunded`) once a non-delivery dispute has sat unanswered long enough to be flagged.
7. **Cancel** — either party can cancel an order while it is still `pending`, before anything is locked. Once locked, resolving a problem goes through the dispute flow above rather than a one-sided cancel.
8. **Review** — once an order is `released`, either party can leave a star rating and comment, aggregated into a reputation badge on the provider's profile. A "Rate now" prompt can be dismissed per-order in the UI (stored in `localStorage`, not the database) and recalled later — dismissing it never affects whether the order can still be reviewed.

Order status (`pending → locking → locked → completed → released`, with `locking → pending` as a self-healing detour if the on-chain transfer fails or times out, `locked ⇄ disputed` as a possible detour before `completed`, `disputed → refunded` if a non-delivery dispute goes unanswered long enough, or `cancelled` from `pending`) renders as a status chip inline in the DM thread, with the relevant action attached — including a pulsing "Locking escrow…" chip while the on-chain transfer is in flight. A dedicated Marketplace page (`/marketplace`) provides two tabs: My Listings and My Orders.

Escrow is custodial, not trustless. The treasury wallet (the same wallet used for verification payments, `VITE_VERIFICATION_TREASURY_WALLET`) is the counterparty for lock and release. Release is only ever performed from the Admin page by that wallet.

### Marketplace automation (scheduled, not user-triggered)

Six functions run on a schedule rather than in response to a click, and are deliberately **not** granted to `anon`/`authenticated` — only `service_role` can call them, since each one processes every eligible order or offer platform-wide in one pass rather than one user's own data:

| Function | Cadence / trigger | Effect |
|---|---|---|
| `auto_revert_stale_escrow_locks` | every 5 minutes; orders stuck in `locking` > 15 minutes | Order → `pending`, `locking_at` cleared — recovers orders whose on-chain transfer never completed or confirmed (e.g. the tab was closed mid-transfer) |
| `auto_decline_expired_offers` | offers pending > 3h | Offer → `declined`, with a system message noting it expired |
| `send_escrow_confirmation_reminders` | 1h after lock, then every 6h, until 24h | Notifies both buyer and provider that confirmation is still pending |
| `auto_dispute_non_delivery` | 24h after lock, no deliverable submitted | Order → `disputed` (`seller_no_delivery_24h`) |
| `auto_flag_refund_eligible_disputes` | 24h after a `seller_no_delivery_24h` dispute, still no deliverable | Order marked `refund_flagged_at`, ready for an operator to run `mark_order_refunded` |
| `auto_complete_unconfirmed_orders` | 72h after delivery, buyer never confirmed | Order → `completed` (`completion_reason: buyer_no_confirm_72h`) |

These run via `pg_cron` if that extension is enabled on the Supabase project (checked automatically by the migrations that create them); otherwise they need to be triggered by an external scheduler (e.g. a GitHub Actions cron job) calling them through the Supabase REST RPC endpoint with the service role key. Without either, the functions exist and can be tested manually from the SQL Editor, but nothing runs automatically.

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
└── supabase/                   # single consolidated schema, no CLI tooling
    └── schema.sql               # the entire database as it stands today — tables, RLS
                                   #   policies, and every SECURITY DEFINER RPC/scheduled
                                   #   function, kept as one file that always matches what's
                                   #   actually deployed (see below)
```

Run `schema.sql` once against a fresh Supabase project to get the full, current database. Through v2.4, this project shipped as a sequence of 20 numbered migration files (`002_harden_writes.sql` → `021_auto_refund_non_delivery.sql`) applied in order, with later files redefining functions from earlier ones — for example `create_post` was redefined first to record quest progress, then again to accept marketplace-listing fields; `confirm_order_complete` was later redefined to require a deliverable link first; `dispute_order` was redefined to cap disputes at one per order. As of v2.4.1 those numbered files have been folded into a single up-to-date `schema.sql`, and any already-deployed project should already have every change in it applied. Going forward, new schema changes ship as small standalone snippets that get run once by hand and then folded into `schema.sql`, instead of a growing chain of numbered files.

---

## Security Model

Every write goes through Supabase RPC functions (`SECURITY DEFINER`):

- `create_post` / `edit_post` / `delete_post` — enforce tier-based character limits, daily post quotas, image-attachment permission, edit permission (Verified Max only), and listing-field validation server-side
- `toggle_follow`, `toggle_repost`, `send_tip` — atomic, ownership-checked
- `purchase_verification` — recomputes price from `TIER_CONFIG` server-side and rejects a `tx_hash` that has already been used
- `award_quest`, `record_wallet_connect`, `get_quest_board` — quest progress bookkeeping
- `get_top_tipped`, `get_top_tipped_posts` — leaderboard reads
- `send_message`, `propose_offer`, `accept_offer`, `decline_offer`, `mark_thread_read`, `delete_message` — direct-message writes and the buyer/provider negotiation flow. `accept_offer` can only be called by the offer's recipient and creates a `pending` row in `orders` with an automatic system message in the same thread. `propose_offer` rejects listings the provider has since deactivated — the client already hides the "Make offer" button/picker once a wallet's `useProviderListings` result is empty, but the RPC enforces it too since that client check can be bypassed. `delete_message` only soft-deletes the caller's own `kind = 'text'` messages — negotiation and order-status messages can't be deleted, since they double as transaction history.
- `begin_escrow_lock`, `abort_escrow_lock`, `lock_escrow_order`, `confirm_order_complete`, `mark_order_released`, `cancel_order`, `mark_order_delivered`, `dispute_order`, `submit_deliverable_revision`, `mark_order_refunded` — the escrow lifecycle. `begin_escrow_lock` reserves an order (`pending` → `locking`) before the client attempts the on-chain transfer; `abort_escrow_lock` releases that reservation back to `pending` if the transfer fails, and only succeeds against an order the caller actually holds in `locking`. `mark_order_released` and `mark_order_refunded` are both validated server-side against the treasury wallet regardless of what the client claims; the Admin-page guard is a UX convenience, not the security boundary. `confirm_order_complete` requires `deliverable_url` to be set before a buyer can confirm. `dispute_order` is capped at one dispute per order via a permanent `dispute_used` flag, independent of `disputed_at`/`dispute_reason` which get cleared on each revision. `mark_order_refunded` additionally refuses to run until `refund_flagged_at` is set — an operator can't refund a non-delivery dispute before it's been flagged by the scheduled function below.
- `auto_revert_stale_escrow_locks`, `auto_decline_expired_offers`, `send_escrow_confirmation_reminders`, `auto_dispute_non_delivery`, `auto_flag_refund_eligible_disputes`, `auto_complete_unconfirmed_orders` — scheduled housekeeping, not user-triggered. Revoked from `anon`/`authenticated` and granted to `service_role` only, since each call processes every eligible order/offer platform-wide rather than one caller's own data; see **Marketplace automation** above.
- `submit_review`, `get_provider_reputation`, `set_listing_active` — reviews and listing management

The `messages` table has no client-side write path — direct insert/update privileges on `messages` are revoked from `anon`/`authenticated`. The `orders` and `reviews` tables follow the same rule: reads are public, writes are RPC-only.

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

A 10-quest, sequentially unlocked progression (`src/components/QuestsPage.tsx`, `src/hooks/useQuests.ts`, backed by `get_quest_board()` in `supabase/schema.sql`) — each quest stays locked until the previous one is completed. Seven easy quests (1 point each), two medium (2 points each), and one hard (3 points) total 14 points:

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
- Post images (`PostCard.tsx`) are letterboxed on a soft background (`object-contain`) rather than cropped to fill (`object-cover`), so portrait or unusually-proportioned images display in full instead of being cut off

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