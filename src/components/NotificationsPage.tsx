import { useEffect, useRef } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { useNotifications } from '../hooks/useNotifications'
import { avatarColor, avatarInitial, shortenAddress } from '../utils/avatar'
import { timeAgo } from '../utils/time'
import { VerifiedBadge } from './VerifiedBadge'
import { BellIcon, CoinIcon, LockIcon, RepostIcon, UserPlusIcon } from './icons'
import type { AppNotification } from '../types'

function NotificationTypeIcon({ type }: { type: AppNotification['type'] }) {
  if (type === 'follow') {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-notify/15 text-notify">
        <UserPlusIcon size={16} />
      </span>
    )
  }
  if (type === 'repost') {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-cyan/15 text-brand-cyan">
        <RepostIcon size={16} />
      </span>
    )
  }
  if (type === 'order_reminder') {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
        <LockIcon size={15} />
      </span>
    )
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
      <CoinIcon size={16} />
    </span>
  )
}

function NotificationRow({
  notification,
  onVisitProfile,
}: {
  notification: AppNotification
  onVisitProfile?: (walletAddress: string) => void
}) {
  const wallet = notification.actor_wallet

  const actionText =
    notification.type === 'follow'
      ? 'followed you'
      : notification.type === 'repost'
        ? 'reposted your post'
        : notification.type === 'order_reminder'
          ? 'has a transaction waiting on confirmation'
          : `tipped you ${notification.amount ?? 0} UCT`

  function visit() {
    onVisitProfile?.(wallet)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`flex w-full cursor-pointer items-start gap-3 border-b border-surface-border px-4 py-3 text-left transition-colors hover:bg-surface/60 ${
        notification.read ? '' : 'bg-notify/[0.06]'
      }`}
      onClick={visit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          visit()
        }
      }}
    >
      <NotificationTypeIcon type={notification.type} />

      <button
        type="button"
        className="h-9 w-9 shrink-0 overflow-hidden rounded-full text-xs font-semibold text-white transition-transform duration-150 hover:scale-105"
        style={{ background: avatarColor(wallet) }}
        onClick={(e) => {
          e.stopPropagation()
          visit()
        }}
        aria-label={`View profile ${shortenAddress(wallet)}`}
      >
        <span className="flex h-full w-full items-center justify-center">
          {notification.actor_avatar_url ? (
            <img src={notification.actor_avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            avatarInitial(wallet)
          )}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className={`truncate font-mono text-[14px] text-ink ${notification.read ? 'font-semibold' : 'font-bold'}`}>
            {shortenAddress(wallet)}
          </span>
          <VerifiedBadge tier={notification.actor_verification_tier} size={13} />
          <span className="text-[14px] text-ink-muted">{actionText}</span>
          <span className="text-ink-faint">·</span>
          <span className="shrink-0 text-[12px] text-ink-muted">{timeAgo(notification.created_at)}</span>
        </div>
        {notification.post_preview && (
          <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">{notification.post_preview}</p>
        )}
        {notification.body && (
          <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-muted">{notification.body}</p>
        )}
      </div>

      {!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-notify" aria-hidden="true" />}
    </div>
  )
}

export function NotificationsPage({
  onVisitProfile,
}: {
  onVisitProfile?: (walletAddress: string) => void
}) {
  const { walletAddress: myWallet, isAutoConnecting, connecting, connect } = useWallet()
  const { notifications, loading, error, unreadCount, markAllRead } = useNotifications()
  const markedRef = useRef(false)

  useEffect(() => {
    if (!loading && unreadCount > 0 && !markedRef.current) {
      markedRef.current = true
      markAllRead()
    }
  }, [loading, unreadCount, markAllRead])

  if (isAutoConnecting) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-ink-muted">Checking wallet…</p>
      </div>
    )
  }

  if (!myWallet) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-ink-muted">Connect your wallet to see your notifications.</p>
        <button
          className="rounded-full bg-brand-gradient px-6 py-2.5 text-[15px] font-semibold text-accent-contrast shadow-glow transition-transform duration-150 hover:scale-[1.03] active:scale-95 disabled:opacity-60"
          onClick={connect}
          disabled={connecting}
        >
          {connecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="px-4 py-3">
        <span className="text-[13px] font-medium text-ink-faint">
          {notifications.length === 0
            ? 'No notifications yet'
            : `${notifications.length} notification${notifications.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {loading ? (
        <p className="py-16 text-center text-[13px] text-ink-muted">Loading notifications…</p>
      ) : error ? (
        <p className="py-16 text-center text-[13px] text-danger">{error}</p>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-ink-faint">
            <BellIcon size={26} />
          </div>
          <p className="max-w-[240px] text-[13px] text-ink-muted">
            No notifications yet. Follows, reposts, and tips on your posts will show up here.
          </p>
        </div>
      ) : (
        notifications.map((n) => <NotificationRow key={n.id} notification={n} onVisitProfile={onVisitProfile} />)
      )}
    </div>
  )
}
