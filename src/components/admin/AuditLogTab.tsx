import { useMemo, useState } from 'react'
import { useOrderAuditLog, type AuditLogRow } from '../../hooks/useOrders'
import { shortenAddress } from '../../utils/avatar'
import { timeAgo } from '../../utils/time'
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, LockIcon, RefundIcon } from '../icons'

const PAGE_SIZE = 10

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function rowsToCsv(rows: AuditLogRow[]): string {
  const header = [
    'When',
    'Listing',
    'Buyer wallet',
    'Provider wallet',
    'Action',
    'Tx hash',
    'Amount',
    'Coin',
  ]
  const lines = rows.map((row) =>
    [
      row.actioned_at,
      row.listing_title ?? 'Untitled listing',
      row.buyer_wallet,
      row.provider_wallet,
      row.action,
      (row.action === 'released' ? row.release_tx_hash : row.refund_tx_hash) ?? '',
      String(row.amount),
      row.coin_symbol,
    ]
      .map((v) => csvEscape(String(v)))
      .join(',')
  )
  return [header.join(','), ...lines].join('\n')
}

function downloadAuditLogCsv(rows: AuditLogRow[]) {
  const csv = rowsToCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `musyawarah-audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function AuditLogTab() {
  const { rows, loading, error } = useOrderAuditLog(500)
  const [page, setPage] = useState(0)

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = useMemo(
    () => rows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [rows, currentPage]
  )

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-ink">Audit log</h2>
          <p className="text-[12px] text-ink-muted">History of payouts released and refunds issued.</p>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-surface-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-hover"
            onClick={() => downloadAuditLogCsv(rows)}
            title="Download the full audit log as a CSV file (opens in Excel, Google Sheets, etc.)"
          >
            <DownloadIcon size={13} />
            Download CSV
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-8 text-center text-[13px] text-ink-muted">Loading…</p>
      ) : error ? (
        <p className="py-8 text-center text-[13px] text-danger">{error}</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-muted">Nothing has been released or refunded yet.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-surface-border">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-surface-border bg-surface text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-3.5 py-2 font-semibold">When</th>
                  <th className="px-3.5 py-2 font-semibold">Order</th>
                  <th className="px-3.5 py-2 font-semibold">Action</th>
                  <th className="px-3.5 py-2 font-semibold">Tx hash</th>
                  <th className="px-3.5 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id} className="border-b border-surface-border last:border-b-0">
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-ink-muted">{timeAgo(row.actioned_at)}</td>
                    <td className="px-3.5 py-2.5">
                      <p className="truncate font-semibold text-ink">{row.listing_title ?? 'Untitled listing'}</p>
                      <p className="truncate text-[11px] text-ink-faint">
                        {shortenAddress(row.buyer_wallet)} → {shortenAddress(row.provider_wallet)}
                      </p>
                    </td>
                    <td className="px-3.5 py-2.5">
                      {row.action === 'released' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
                          <LockIcon size={10} />
                          Released
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
                          <RefundIcon size={10} />
                          Refunded
                        </span>
                      )}
                    </td>
                    <td className="max-w-[140px] truncate px-3.5 py-2.5 font-mono text-[11px] text-ink-faint">
                      {(row.action === 'released' ? row.release_tx_hash : row.refund_tx_hash) ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-semibold text-ink">
                      {row.amount} {row.coin_symbol}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="mt-3 flex items-center justify-between text-[12px] text-ink-muted">
              <span>
                Page {currentPage + 1} of {pageCount} · {rows.length} total
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-surface-border text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon size={14} />
                </button>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-surface-border text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={currentPage >= pageCount - 1}
                  aria-label="Next page"
                >
                  <ChevronRightIcon size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
