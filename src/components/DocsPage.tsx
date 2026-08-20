import {
  BriefcaseIcon,
  ChevronLeftIcon,
  CoinIcon,
  DocsIcon,
  MessageIcon,
  SearchIcon,
  TrophyIcon,
  UserIcon,
  VerifiedNavIcon,
} from './icons'

interface DocSection {
  id: string
  title: string
  icon: (props: { size?: number }) => JSX.Element
  iconBg: string
  iconColor: string
  intro: string
  points?: string[]
}

const SECTIONS: DocSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    icon: DocsIcon,
    iconBg: 'bg-brand-violet/15',
    iconColor: 'text-brand-blue',
    intro:
      'Musyawarah is a social app built on Unicity Labs where identity, payments, and marketplace deals all run through your on-chain wallet instead of a traditional account system.',
    points: [
      'Posting and following work like a normal social feed.',
      'Every post can be tipped directly in UCT, wallet to wallet, on-chain.',
      'Anyone can list a skill or service for sale, and orders settle through an escrow flow rather than a direct payment.',
      'Verification tiers, paid in UCT, raise your posting limits and add a badge next to your name.',
    ],
  },
  {
    id: 'account',
    title: 'Account & wallet',
    icon: UserIcon,
    iconBg: 'bg-gold/15',
    iconColor: 'text-gold',
    intro:
      'There is no email or password. Your Sphere Wallet address is your account — connecting it is the only sign-up step.',
    points: [
      'Connecting works differently depending on context: inside the Sphere wallet\'s own app it talks to the wallet directly, and from a regular browser tab it opens a Sphere Connect popup window.',
      'Once connected, you can set a display name, upload an avatar photo, and write a short bio (up to 160 characters) from your profile.',
      'Your profile page shows two tabs — Posts and Listings — plus your follower/following counts and, if you\'ve completed orders as a provider, your average rating.',
      'A Copy Link button on posts and profiles lets you grab a shareable URL.',
      'Following another wallet is a single tap from their profile and affects their follower count and your following list.',
    ],
  },
  {
    id: 'posts',
    title: 'Posts, reposts & tipping',
    icon: CoinIcon,
    iconBg: 'bg-brand-violet/15',
    iconColor: 'text-brand-blue',
    intro:
      'Posting works like any social feed, but how much you can post is gated by your verification tier, and every post can be rewarded directly in UCT.',
    points: [
      'Your character limit and daily post quota depend on your tier — see the Verification table below for exact numbers. Quotas reset at 00:00 UTC every day.',
      'Verified Pro and Verified Max accounts can attach an image to a post; Verified Max accounts can also edit a post after publishing.',
      'Tapping the coin icon on a post lets you send a tip in UCT — it\'s a direct, instant on-chain transfer from your wallet to the creator\'s, with no intermediary holding the funds. You can\'t tip your own posts.',
      'Reposting shares someone else\'s post to your followers as-is and counts toward that post\'s standing on the Trending leaderboard.',
      'The Home feed can be filtered to All, Posts only, or Listings only, and listings can be further filtered by category.',
    ],
  },
  {
    id: 'marketplace',
    title: 'Marketplace & escrow',
    icon: BriefcaseIcon,
    iconBg: 'bg-gold/15',
    iconColor: 'text-gold',
    intro:
      'The Marketplace turns any post into a sellable skill or service, with payment protected by an escrow flow rather than sent straight to the seller.',
    points: [
      'To sell something, tap the briefcase icon while composing a post, then set a title, a category, and a price in UCT — either "per task" (one-off) or "subscription" (recurring).',
      'The Marketplace page has three tabs: Browse (every active listing, filterable by category), My Listings (listings you\'ve posted), and Orders (every order you\'re part of, as buyer or provider).',
    ],
  },
  {
    id: 'escrow-flow',
    title: 'How an order moves through escrow',
    icon: BriefcaseIcon,
    iconBg: 'bg-gold/15',
    iconColor: 'text-gold',
    intro: 'An order goes through a fixed sequence of on-chain steps, visible as status chips inside the conversation:',
    points: [
      '1. Negotiate — open "Negotiate & Hire" on a listing to start a chat with the provider. Either side can send a formal offer with an amount and coin, which the other side accepts or declines.',
      '2. Lock — once an offer is accepted, the buyer locks the agreed amount into escrow rather than paying the provider directly.',
      '3. Deliver — the provider completes the work and submits a delivery link.',
      '4. Confirm or dispute — the buyer reviews the delivery and either confirms completion (releasing escrow to the provider) or files a dispute with a note. Each order allows exactly one dispute; after that, the provider\'s next delivery is final.',
      '5. Auto-complete — if the buyer takes no action for 72 hours after delivery, the order auto-completes and escrow releases automatically.',
      '6. No-show refund — if a provider never delivers and never responds, the order is flagged after a 48-hour window and reviewed for a refund back to the buyer\'s wallet.',
      'After an order completes, both sides can leave a rating and comment, which feeds into the provider\'s public reputation score.',
      'An order can be cancelled before escrow is locked; once funds are locked, it has to run through delivery, confirmation, or the dispute/refund path instead.',
    ],
  },
  {
    id: 'verification',
    title: 'Verification tiers',
    icon: VerifiedNavIcon,
    iconBg: 'bg-brand-violet/15',
    iconColor: 'text-brand-blue',
    intro:
      'Verification is a paid upgrade — billed in UCT the same way a tip is sent — that raises your posting limits and adds a badge. Yearly billing is a single charge for 12 months at a 15% discount versus paying monthly. Buying a new tier replaces your current one; tiers don\'t stack.',
  },
  {
    id: 'quests',
    title: 'Quests & leaderboard',
    icon: TrophyIcon,
    iconBg: 'bg-surface-hover',
    iconColor: 'text-ink',
    intro: 'Two separate systems reward activity on the app: quests, and the tipping leaderboard.',
    points: [
      'Quests unlock in order — each one stays locked until the one before it is completed — and each completed quest earns points shown at the top of the Quests page.',
      'The Top Tipped leaderboard (right panel) ranks by UCT tips received, switchable between "This Week" and "All-Time", with separate tabs for top Users and top Trending posts.',
    ],
  },
  {
    id: 'messages',
    title: 'Messages & notifications',
    icon: MessageIcon,
    iconBg: 'bg-brand-violet/15',
    iconColor: 'text-brand-blue',
    intro: 'Direct messages double as the marketplace negotiation and order-tracking surface.',
    points: [
      'A conversation can contain plain text, a shared listing card, a formal offer (with accept/decline), and live order-status chips as an order moves through escrow.',
      'Notifications cover four events: someone follows you, reposts your post, tips your post, or an order you\'re part of needs attention (an order reminder).',
    ],
  },
  {
    id: 'discovery',
    title: 'Search & settings',
    icon: SearchIcon,
    iconBg: 'bg-gold/15',
    iconColor: 'text-gold',
    intro: 'A few smaller tools round out the app.',
    points: [
      'The search box in the right panel looks up users by name or wallet as you type.',
      'Settings holds the dark mode toggle, plus this Help and Docs page.',
    ],
  },
]

const TIER_ROWS = [
  { tier: 'Free', monthly: '0', yearly: '—', posts: '1 / day', chars: '60', image: false, edit: false, badge: 'None' },
  {
    tier: 'Verified',
    monthly: '30',
    yearly: '306',
    posts: '2 / day',
    chars: '150',
    image: false,
    edit: false,
    badge: 'Blue check',
  },
  {
    tier: 'Verified Pro',
    monthly: '50',
    yearly: '510',
    posts: '2 / day',
    chars: '250',
    image: true,
    edit: false,
    badge: 'Gold check',
  },
  {
    tier: 'Verified Max',
    monthly: '100',
    yearly: '1,020',
    posts: '3 / day',
    chars: '350',
    image: true,
    edit: true,
    badge: 'Indigo check',
  },
]

export function DocsPage({ onBack }: { onBack?: () => void }) {
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-violet/15 text-brand-blue">
            <DocsIcon size={18} />
          </span>
          <div>
            <h1 className="m-0 font-display text-[22px] font-bold text-ink">Docs</h1>
            <p className="m-0 text-[13px] text-ink-muted">How Musyawarah works, end to end.</p>
          </div>
        </div>

        <nav className="mt-4 flex flex-wrap gap-1.5 border-b border-surface-border pb-4">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-surface-border px-2.5 py-1 text-[11.5px] font-semibold text-ink-muted transition-colors hover:border-brand-violetSoft hover:text-ink"
            >
              {section.title}
            </a>
          ))}
        </nav>

        <div className="mt-5 flex flex-col gap-6">
          {SECTIONS.map((section) => {
            const SectionIcon = section.icon
            return (
              <div key={section.id} id={section.id} className="scroll-mt-20">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${section.iconBg} ${section.iconColor}`}
                  >
                    <SectionIcon size={14} />
                  </span>
                  <h2 className="m-0 font-display text-[16px] font-bold text-ink">{section.title}</h2>
                </div>

                <p className="m-0 text-[13.5px] leading-relaxed text-ink-muted">{section.intro}</p>

                {section.points && (
                  <ul className="mt-2.5 flex list-none flex-col gap-1.5 pl-0">
                    {section.points.map((point) => (
                      <li
                        key={point}
                        className="flex gap-2 rounded-xl border border-surface-border bg-base px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-muted"
                      >
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.id === 'verification' && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[560px] border-collapse text-left text-[12.5px]">
                      <thead>
                        <tr className="border-b border-surface-border text-ink-muted">
                          <th className="py-2 pr-3 font-semibold">Tier</th>
                          <th className="py-2 pr-3 font-semibold">UCT / mo</th>
                          <th className="py-2 pr-3 font-semibold">UCT / yr</th>
                          <th className="py-2 pr-3 font-semibold">Posts</th>
                          <th className="py-2 pr-3 font-semibold">Chars</th>
                          <th className="py-2 pr-3 font-semibold">Image</th>
                          <th className="py-2 pr-3 font-semibold">Edit</th>
                          <th className="py-2 pr-3 font-semibold">Badge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {TIER_ROWS.map((row) => (
                          <tr key={row.tier} className="border-b border-surface-border last:border-0">
                            <td className="py-2.5 pr-3 font-semibold text-ink">{row.tier}</td>
                            <td className="py-2.5 pr-3 text-ink-muted">{row.monthly}</td>
                            <td className="py-2.5 pr-3 text-ink-muted">{row.yearly}</td>
                            <td className="py-2.5 pr-3 text-ink-muted">{row.posts}</td>
                            <td className="py-2.5 pr-3 text-ink-muted">{row.chars}</td>
                            <td className="py-2.5 pr-3 text-ink-muted">{row.image ? 'Yes' : '—'}</td>
                            <td className="py-2.5 pr-3 text-ink-muted">{row.edit ? 'Yes' : '—'}</td>
                            <td className="py-2.5 pr-3 text-ink-muted">{row.badge}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-[11.5px] text-ink-faint">
                      Yearly prices already include the 15% annual discount. Daily post quotas reset at 00:00 UTC.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="mt-6 text-center text-[12.5px] text-ink-faint">
          Looking for quick answers instead? Check the Help page from Settings.
        </p>
      </div>
    </div>
  )
}