# Changelog

All notable changes to Musyawarah are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.4.1]

### Added
- **Two-phase escrow locking.** Locking payment on an order is no longer a single step. The buyer's order is first reserved server-side (`begin_escrow_lock`, new `locking` order status, new `locking_at` column) *before* the on-chain tip is sent; only a confirmed reservation is allowed to move to `locked`. This closes a gap where a rejected or failed wallet transaction could leave an order in an ambiguous state with no record that a lock was ever attempted.
- **`abort_escrow_lock` RPC**, called automatically if the on-chain transfer fails or is rejected in the wallet, returning the order to `pending` so the buyer can simply retry.
- **`auto_revert_stale_escrow_locks` scheduled function**, run every 5 minutes via `pg_cron`, which reverts any order still stuck in `locking` after 15 minutes back to `pending` — covers the case of a buyer closing the tab mid-transfer.
- **"Locking escrow…" status chip**, with a pulsing indicator and a "Waiting for the on-chain transaction to confirm…" message, shown in the order thread while the on-chain transfer is in flight.
- **`isValidHexCoinId()` helper** in `sphereConnect.ts` for validating that a wallet-reported UCT `coinId` is well-formed (even-length lowercase hex).

### Changed
- `WalletContext`'s `resolveUctCoin()` now validates every coinId candidate from `sphere_getAssets` / `sphere_getTokens` before trusting it, discarding malformed values instead of using them as-is. If no valid coinId can be resolved at all, it now throws a descriptive error instead of silently falling back to the literal string `"UCT"` — a bad fallback that could previously fail wallet-side without a clear cause.
- Post images (`PostCard.tsx`) switched from `object-cover` to `object-contain` on a soft background, so non-landscape images display in full instead of being cropped.
- Consolidated all 20 numbered SQL migrations (`002_harden_writes.sql` through `021_auto_refund_non_delivery.sql`) into a single `supabase/schema.sql` representing the database as currently deployed. New schema changes now ship as small, idempotent snippets instead of another numbered file.
- Bumped `package.json` version to `2.4.1`.

### Fixed
- Eliminated the window where a buyer's rejected or failed escrow transaction left no trace in `orders`, making it unclear whether a lock had been attempted — the order now visibly passes through `locking` and either advances to `locked` or cleanly reverts to `pending`.

---

## [2.4.0]

Initial tracked baseline. Includes wallet authentication via Sphere, posts with tiered image attachments, tipping, reposts, subscription-based verification tiers, private messaging with negotiation cards, real-time notifications, a 10-step quest line, a Top Tipped leaderboard, user search/profiles, shareable URLs, the full marketplace escrow flow (list → negotiate → order → escrow → deliver → confirm/dispute/drift → cancel → review) with its scheduled automation functions, and the monochrome light/dark design system.
