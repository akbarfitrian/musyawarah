import { useState } from 'react'
import { useWallet } from '../../contexts/WalletContext'
import { TREASURY_WALLET, useCompletedOrders, useRefundEligibleOrders } from '../../hooks/useOrders'
import { fromBaseUnits } from '../../lib/sphereConnect'
import { LockIcon, LogoMark, LogoutIcon, RefundIcon, ListIcon } from '../icons'
import { PayoutsTab } from './PayoutsTab'
import { RefundsTab } from './RefundsTab'
import { AuditLogTab } from './AuditLogTab'

type AdminTab = 'payouts' | 'refunds' | 'audit'

export function AdminShell({ onExit }: { onExit: () => void }) {
  const { walletAddress, assets } = useWallet()
  const isTreasury = Boolean(walletAddress) && walletAddress === TREASURY_WALLET
  const [tab, setTab] = useState<AdminTab>('payouts')

  const payouts = useCompletedOrders()
  const refunds = useRefundEligibleOrders()

  const uct = assets.find((a) => a.symbol === 'UCT')
  const uctBalance = uct ? fromBaseUnits(uct.amountBase, uct.decimals) : null

  if (!isTreasury) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base px-4">
        <div className="text-center">
          <p className="text-[14px] text-ink-muted">This page can only be accessed by the treasury/operator wallet.</p>
          <button
            type="button"
            className="mt-3 rounded-full bg-surface px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-hover"
            onClick={onExit}
          >
            Back home
          </button>
        </div>
      </div>
    )
  }

  const pendingPayouts = payouts.orders.length
  const pendingRefunds = refunds.orders.length

  const tabs: { id: AdminTab; label: string; icon: JSX.Element; badge: number }[] = [
    { id: 'payouts', label: 'Payouts', icon: <LockIcon size={16} />, badge: pendingPayouts },
    { id: 'refunds', label: 'Refunds', icon: <RefundIcon size={16} />, badge: pendingRefunds },
    { id: 'audit', label: 'Audit Log', icon: <ListIcon size={16} />, badge: 0 },
  ]

  return (
    <div className="min-h-screen bg-base">
      <header className="sticky top-0 z-10 border-b border-surface-border bg-base/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[900px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-black">
              <LogoMark size={18} />
            </div>
            <h1 className="font-display text-[16px] font-bold tracking-tight text-ink">Musyawarah Admin</h1>
          </div>

          <div className="flex items-center gap-2">
            {uctBalance !== null && (
              <span className="rounded-full border border-surface-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink">
                {uctBalance} UCT
              </span>
            )}
            {(pendingPayouts > 0 || pendingRefunds > 0) && (
              <span className="rounded-full border border-surface-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink-muted">
                Pending: {pendingPayouts} payout{pendingPayouts === 1 ? '' : 's'} · {pendingRefunds} refund
                {pendingRefunds === 1 ? '' : 's'}
              </span>
            )}
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
              onClick={onExit}
            >
              <LogoutIcon size={14} />
              Exit to app
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-[900px] gap-1 px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-[13px] font-semibold transition-colors ${
                tab === t.id
                  ? 'border-ink text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              {t.label}
              {t.badge > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-notify px-1 text-[10px] font-bold text-white">
                  {t.badge > 9 ? '9+' : t.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[900px] px-4 py-5">
        {tab === 'payouts' ? (
          <PayoutsTab
            orders={payouts.orders}
            loading={payouts.loading}
            error={payouts.error}
            refresh={payouts.refresh}
          />
        ) : tab === 'refunds' ? (
          <RefundsTab
            orders={refunds.orders}
            loading={refunds.loading}
            error={refunds.error}
            refresh={refunds.refresh}
          />
        ) : (
          <AuditLogTab />
        )}
      </main>
    </div>
  )
}
