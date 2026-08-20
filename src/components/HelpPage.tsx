import { useState } from 'react'
import {
  BriefcaseIcon,
  BellIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  CoinIcon,
  HelpIcon,
  MessageIcon,
  TrophyIcon,
  VerifiedNavIcon,
} from './icons'

interface FaqItem {
  id: string
  q: string
  a: string
}

interface FaqSection {
  title: string
  icon: (props: { size?: number }) => JSX.Element
  iconBg: string
  iconColor: string
  items: FaqItem[]
}

const SECTIONS: FaqSection[] = [
  {
    title: 'Getting started',
    icon: HelpIcon,
    iconBg: 'bg-gold/15',
    iconColor: 'text-gold',
    items: [
      {
        id: 'start-wallet',
        q: 'How do I get started?',
        a: 'Tap "Connect Wallet" and log in with your Sphere Wallet — that\'s your account. There\'s no email or password to set up. Once connected, your wallet address becomes your identity across the whole app, and you can add a name, avatar, and bio from your profile.',
      },
      {
        id: 'start-uct',
        q: 'What is UCT?',
        a: 'UCT is the token everything in the app runs on — tipping, marketplace payments, and verification billing all move in UCT, straight from your Sphere Wallet. Every payment is a real on-chain transaction, not an in-app balance.',
      },
      {
        id: 'start-connect-modes',
        q: 'Where does the Connect Wallet popup open?',
        a: "It depends on how you're using the app. Inside the Sphere wallet's own app, connecting talks directly to the wallet. In a regular browser tab, it opens a real popup window to the Sphere Connect page — make sure popups aren't blocked for this site.",
      },
    ],
  },
  {
    title: 'Posts & tipping',
    icon: CoinIcon,
    iconBg: 'bg-brand-violet/15',
    iconColor: 'text-brand-blue',
    items: [
      {
        id: 'posts-limits',
        q: 'Why can\'t I post more, or write a longer post?',
        a: 'Your daily post count and character limit depend on your verification tier: Free gives 1 post a day at 60 characters, Verified gives 2 posts at 150 characters, Verified Pro gives 2 posts at 250 characters plus image attachments, and Verified Max gives 3 posts at 350 characters plus images and post editing. Daily quotas reset at 00:00 UTC.',
      },
      {
        id: 'posts-tipping',
        q: 'How does tipping work?',
        a: "Tap the coin icon on any post, enter an amount, and confirm. It's a direct on-chain transfer of UCT from your wallet to the creator's — no middleman holding funds, and it settles instantly. You can't tip your own posts.",
      },
      {
        id: 'posts-repost',
        q: 'What does repost do?',
        a: "Reposting shares someone else's post to your own followers without editing it. It also counts toward that post's total reposts and toward the creator's ranking on the Trending leaderboard.",
      },
      {
        id: 'posts-listing',
        q: 'What\'s the difference between a normal post and a listing?',
        a: 'When composing a post, tap the briefcase icon to turn it into a skill listing instead of a regular post. You give it a title, a category, and a price — either "per task" (one-off) or "subscription" (recurring) — priced in UCT. Listings show up on the Marketplace and can be hired directly.',
      },
    ],
  },
  {
    title: 'Marketplace & escrow',
    icon: BriefcaseIcon,
    iconBg: 'bg-gold/15',
    iconColor: 'text-gold',
    items: [
      {
        id: 'mp-tabs',
        q: 'What are the Browse / My Listings / Orders tabs?',
        a: 'Browse shows every active listing on the app, filterable by category. My Listings shows the skill listings you\'ve posted yourself. Orders shows every order you\'re involved in, whether you\'re the buyer or the provider.',
      },
      {
        id: 'mp-hire',
        q: 'How do I hire someone?',
        a: 'Open a listing and tap "Negotiate & Hire" to start a chat with the provider. From that conversation you (or they) can send a formal offer with an amount and coin, which the other side then accepts or declines.',
      },
      {
        id: 'mp-escrow',
        q: 'How does escrow actually work?',
        a: 'Once an offer is accepted, the buyer locks the payment into escrow rather than paying the provider directly. The provider then delivers the work with a link. The buyer reviews it and confirms completion, which releases the escrowed UCT to the provider on-chain.',
      },
      {
        id: 'mp-autocomplete',
        q: 'What happens if the buyer never confirms?',
        a: "If a provider delivers and the buyer doesn't confirm or dispute within 72 hours, the order auto-completes and the escrow releases to the provider automatically.",
      },
      {
        id: 'mp-dispute',
        q: 'What if I\'m not happy with the delivery?',
        a: "As the buyer, you get one dispute per order. Disputing sends the order back to the provider with your note attached, and they can submit a corrected delivery link. Once you've used your dispute on an order, you can't dispute it again — the next delivery is final.",
      },
      {
        id: 'mp-noshow',
        q: 'What if the provider never delivers at all?',
        a: "If a provider never delivers and never responds, the order gets flagged for a refund after a 48-hour window. From there it's reviewed and the escrowed amount is sent back to the buyer's wallet.",
      },
      {
        id: 'mp-cancel',
        q: 'Can I cancel an order?',
        a: "Orders can be cancelled before the escrow is locked. Once funds are locked in escrow, the order has to run through delivery, confirmation, or the dispute/refund flow above rather than being cancelled outright.",
      },
    ],
  },
  {
    title: 'Get Verified',
    icon: VerifiedNavIcon,
    iconBg: 'bg-brand-violet/15',
    iconColor: 'text-brand-blue',
    items: [
      {
        id: 'verify-tiers',
        q: 'What do the verification tiers give me?',
        a: 'Verified (30 UCT/mo) adds a blue checkmark, 2 posts a day, and a 150-character limit. Verified Pro (50 UCT/mo) adds a gold checkmark, a 250-character limit, and image attachments. Verified Max (100 UCT/mo) adds an indigo checkmark, 3 posts a day, a 350-character limit, images, and the ability to edit posts after publishing.',
      },
      {
        id: 'verify-billing',
        q: 'Monthly or yearly — what\'s the difference?',
        a: 'Yearly billing charges once for 12 months at a 15% discount versus paying monthly — Verified is 306 UCT/yr, Verified Pro is 510 UCT/yr, and Verified Max is 1,020 UCT/yr. Payment works exactly like sending a tip: a direct on-chain transfer from your wallet.',
      },
      {
        id: 'verify-switch',
        q: 'Can I switch or upgrade tiers?',
        a: "Yes. Tiers don't stack — buying a new tier immediately replaces whatever tier you currently have, rather than adding to it. You can switch tiers or billing interval any time from the Get Verified page.",
      },
    ],
  },
  {
    title: 'Quests & leaderboard',
    icon: TrophyIcon,
    iconBg: 'bg-surface-hover',
    iconColor: 'text-ink',
    items: [
      {
        id: 'quests-order',
        q: 'How do quests work?',
        a: 'Quests are completed in order — each one stays locked until the one before it is done. Completing a quest earns points, and your progress and point total are tracked at the top of the Quests page.',
      },
      {
        id: 'leaderboard',
        q: 'How does the Top Tipped leaderboard work?',
        a: 'The leaderboard on the right panel ranks by UCT tips received, with a "This Week" and an "All-Time" view. It has two tabs — Users, for the most-tipped people, and Trending, for the most-tipped individual posts.',
      },
    ],
  },
  {
    title: 'Messages & notifications',
    icon: MessageIcon,
    iconBg: 'bg-brand-violet/15',
    iconColor: 'text-brand-blue',
    items: [
      {
        id: 'msg-general',
        q: 'What can I do inside a chat?',
        a: "Chats support plain text as well as marketplace actions in the same thread: a shared listing card, a formal offer with accept/decline, and order-status updates as an order moves through escrow, delivery, and completion.",
      },
      {
        id: 'notif-types',
        q: 'What shows up in Notifications?',
        a: "You'll be notified when someone follows you, reposts one of your posts, tips one of your posts, or when an order you're part of needs attention (an order reminder).",
      },
    ],
  },
  {
    title: 'Troubleshooting',
    icon: BellIcon,
    iconBg: 'bg-danger/10',
    iconColor: 'text-danger',
    items: [
      {
        id: 'trouble-connect',
        q: "My wallet won't connect — what do I try first?",
        a: "Refresh the page and make sure your Sphere Wallet extension or app is unlocked. If you're connecting from a regular browser tab, check that the connect popup wasn't blocked — allow popups for this site and try again.",
      },
      {
        id: 'trouble-tx',
        q: 'A tip, payment, or refund didn\'t go through — what happened?',
        a: "Every payment in the app is a real on-chain transaction, so it can fail for the same reasons any transfer can: insufficient UCT balance, a rejected signature in your wallet, or a dropped transaction. Nothing is marked as sent, paid, or refunded until a matching transaction hash is confirmed, so a failed transaction simply won't go through rather than silently succeeding.",
      },
    ],
  },
]

export function HelpPage({ onBack }: { onBack?: () => void }) {
  const [openId, setOpenId] = useState<string | null>('start-wallet')

  function toggle(id: string) {
    setOpenId((current) => (current === id ? null : id))
  }

  return (
    <div>
      {onBack && (
        <button
          type="button"
          className="mb-4 flex items-center gap-1.5 text-[14px] font-medium text-ink-muted transition-colors hover:text-ink"
          onClick={onBack}
        >
          <ChevronLeftIcon size={16} />
          Back
        </button>
      )}

      <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
            <HelpIcon size={18} />
          </span>
          <div>
            <h1 className="m-0 font-display text-[22px] font-bold text-ink">Help</h1>
            <p className="m-0 text-[13px] text-ink-muted">Answers on wallets, tipping, escrow, verification, and more.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-6">
          {SECTIONS.map((section) => {
            const SectionIcon = section.icon
            return (
              <div key={section.title}>
                <div className="mb-2 flex items-center gap-2 px-0.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${section.iconBg} ${section.iconColor}`}
                  >
                    <SectionIcon size={13} />
                  </span>
                  <h2 className="m-0 text-[13px] font-bold uppercase tracking-wide text-ink-muted">
                    {section.title}
                  </h2>
                </div>

                <div className="flex flex-col gap-2">
                  {section.items.map((item) => {
                    const open = openId === item.id
                    return (
                      <div
                        key={item.id}
                        className="overflow-hidden rounded-xl border border-surface-border bg-base"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                          aria-expanded={open}
                          onClick={() => toggle(item.id)}
                        >
                          <span className="text-[14px] font-semibold text-ink">{item.q}</span>
                          <ChevronDownIcon
                            size={16}
                            className={`shrink-0 text-ink-muted transition-transform duration-200 ${
                              open ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        {open && (
                          <p className="m-0 px-4 pb-4 text-[13.5px] leading-relaxed text-ink-muted">{item.a}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-6 text-center text-[12.5px] text-ink-faint">
          Still stuck? Check the Docs page from Settings for a full end-to-end walkthrough.
        </p>
      </div>
    </div>
  )
}