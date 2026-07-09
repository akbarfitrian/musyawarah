# Changelog — Musyawarah v0.2 → v2.1

This document summarizes everything that changed between the `v1` codebase (`package.json` version `0.2.0`) and `v2.1` (`2.1.0`), based on a full diff of both source trees. No dependencies were added or removed — this is entirely new application code and SQL migrations on top of the same stack.

---

## Highlights

- **Marketplace is now a first-class feature**, shipped end-to-end: listings → in-chat negotiation → escrow → payout release → reviews.
- **Every profile, post, and DM thread now has its own URL** (shareable, bookmarkable, works with browser Back/Forward), replacing the old in-memory view state.
- **A critical wallet bug is fixed**: under certain response shapes from the Sphere wallet, a successful transfer could previously be reported as "failed," prompting users to retry and pay twice.
- **The last unhardened write path is closed**: direct messages now go through `SECURITY DEFINER` RPCs like every other table, instead of unrestricted client-side inserts/updates.

---

## 1. Marketplace (new)

Shipped in five phases (migrations `006`–`011`):

### Fase 1 — Listings (`006_marketplace_listings.sql`)
- Any post can now double as a skill/agent-for-hire listing: title, category, price, and price mode (per-task or subscription).
- `PostComposer` gained a "Post skill listing" toggle with its own validated fields.
- `create_post()` / `edit_post()` re-validate listing fields server-side (title/price required, price mode enforced) — never trusts the client.
- Listings render as a badge/price card on `PostCard`, and the Home feed gained an **All / Listings** tab filter.

### Fase 2 — In-chat negotiation (`007_marketplace_negotiation.sql`)
- A **"Negotiate & Hire"** button on listing cards opens a DM with the provider and auto-sends a `listing_ref` card as the first message.
- Either side can propose a price via an `offer` bubble (Accept/Decline).
- Accepting an offer atomically creates a `pending` row in a new `orders` table plus an automatic `order_update` system message in the same thread.
- **Security gap closed:** the `messages` table was the one table still written to directly from the client with permissive RLS (`using (true)`). As of this migration, all message writes go through RPCs (`send_message`, `propose_offer`, `accept_offer`, `decline_offer`, `mark_thread_read`), and direct `insert`/`update` privileges are revoked from `anon`/`authenticated`.

### Fase 3 — Escrow (`008_marketplace_escrow_rpc.sql`, `010_fix_treasury_wallet.sql`, `011_cancel_and_supersede_orders.sql`)
- New RPCs: `lock_escrow_order`, `confirm_order_complete`, `mark_order_released`, all using the existing `VITE_VERIFICATION_TREASURY_WALLET` as the escrow custodian (same wallet reused for verification payments).
- A single `OrderUpdateChip` component now renders every order state (`pending`, `locked`, `completed`, `released`, `disputed`, `cancelled`) inline in the chat thread, with **Lock escrow** and **Confirm task complete** actions.
- **`cancel_order()`** lets either party cancel a still-`pending` order (before any funds are locked). Once `locked`, cancellation requires manual dispute handling.
- **`accept_offer()`** now auto-supersedes any stale `pending` order for the same post/buyer/provider pair when a new offer is accepted, so re-negotiating a price no longer leaves orphaned "Lock escrow" prompts in the thread.
- Fixed bug: `008` had accidentally pasted the literal string `VITE_VERIFICATION_TREASURY_WALLET=@...` into `v_treasury_wallet` instead of the wallet address itself, which meant `mark_order_released()` rejected the real operator wallet every time. Fixed in `010`.

### Fase 4 — Reviews & Marketplace overview page (`009_marketplace_reviews.sql`)
- New `reviews` table + `submit_review()` / `get_provider_reputation()` RPCs.
- Star ratings (`RatingStars`) now appear next to a provider's `VerifiedBadge` on their profile once they have at least one review.
- New **`MarketplacePage`** (`/marketplace`) with two tabs: **My Listings** (toggle active/inactive via `set_listing_active`) and **My Orders** (grouped by status, linking back to the relevant DM thread).

### Admin (`011.1`, no dedicated migration — RPC already existed)
- New **`AdminPage`** (`/admin`), visible in the sidebar only to the treasury wallet, lets the operator release completed-order payouts from the UI instead of the Supabase SQL editor. The actual authorization check still happens server-side inside `mark_order_released()` — the UI guard is convenience, not the security boundary.

---

## 2. Routing overhaul

- Added a dependency-free, hash-based router (`src/utils/routes.ts` + `src/hooks/useRouter.ts`) — no `react-router`, works on any static host, and survives being loaded inside Sphere's iframe.
- `App.tsx` no longer juggles `view` / `viewedWallet` / `dmTarget` / `highlightPostId` as separate `useState` hooks; all of it now lives in one `Route` object driven by `window.location.hash`.
- **Every profile, post, and DM thread has a real URL** (`#/profile/0x…`, `#/post/…`, `#/messages/0x…`) that can be copied, shared, or bookmarked, and the browser's Back/Forward buttons behave correctly.
- New **`CopyLinkButton`** component added next to post timestamps and profile headers.

## 3. Post permalinks

- New **`PostPage`** component renders a single post standalone at `#/post/:id` (`usePost.ts` hook), the "profile row" equivalent of a tweet's permalink page.
- Clicking a post's timestamp (previously static text) now navigates to that post's permalink.

## 4. Wallet transfer reliability fix (bug fix)

- `WalletContext.tsx`'s `sendTip()` previously looked only for `txHash` / `hash` / `tx.hash` in the wallet's response — but Sphere/Unicity isn't an EVM-style chain and doesn't always return a "tx hash." It can return `transferId`, `transfer.id`, `tx.id`, `tokenId`, etc. depending on wallet version.
- **The real problem:** if none of those fields were present, the old code threw an error *after the funds had already left the wallet*, which surfaced as a failure to the user — who would then retry and send the payment a second time (an actual double-charge was reported in testing: two separate `-5 UCT` transfers for one order).
- Fixed by broadening the field lookup and, if nothing recognizable comes back, falling back to a client-generated identifier instead of throwing. `lock_tx_hash` in the DB is documented as an audit trail, not on-chain proof, so this is safe.

## 5. Other changes

- Read-receipts (`mark_thread_read`) moved from a direct `.update()` call to an RPC, consistent with the RLS hardening in Fase 2.
- User-facing error strings in `WalletContext`, `ProfileContext`, and `ThemeContext` were translated from Indonesian to English for consistency with the rest of the UI copy.
- New icons: `LinkIcon`, `CheckIcon`, `BriefcaseIcon`, `LockIcon`, `StarIcon`, `TagIcon`.

## 6. Data model additions (`types.ts`)

- `Post`: `is_listing`, `listing_title`, `listing_category`, `listing_price_amount`, `listing_price_mode`, `listing_coin_symbol`, `listing_active`
- `Message`: `kind` (`'text' | 'listing_ref' | 'offer' | 'order_update'`), `payload`
- New types: `Order`, `OrderStatus`, `OrderUpdatePayload`, `Review`, `ProviderReputation`, `ListingSnapshot`, `OfferPayload`, `ListingRefPayload`

## 7. New files

```
src/components/AdminPage.tsx
src/components/MarketplacePage.tsx
src/components/PostPage.tsx
src/components/OrderUpdateChip.tsx
src/components/RatingStars.tsx
src/components/CopyLinkButton.tsx
src/config/listingCategories.ts
src/hooks/useOrders.ts
src/hooks/usePost.ts
src/hooks/useReviews.ts
src/hooks/useRouter.ts
src/utils/routes.ts
supabase/006_marketplace_listings.sql
supabase/007_marketplace_negotiation.sql
supabase/008_marketplace_escrow_rpc.sql
supabase/009_marketplace_reviews.sql
supabase/010_fix_treasury_wallet.sql
supabase/011_cancel_and_supersede_orders.sql
```

## 8. Version

`package.json` version bumped `0.2.0` → `2.1.0`. No dependency changes.
