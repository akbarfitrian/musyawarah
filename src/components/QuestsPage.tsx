import { useWallet } from '../contexts/WalletContext'
import { useQuests } from '../hooks/useQuests'
import { ChevronLeftIcon, TrophyIcon } from './icons'

export function QuestsPage({ onBack }: { onBack?: () => void }) {
  const { walletAddress } = useWallet()
  const { quests, loading, error, completedCount, totalPoints, maxPoints } = useQuests()

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
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-hover text-ink">
            <TrophyIcon size={20} />
          </span>
          <div>
            <h1 className="m-0 font-display text-[22px] font-bold text-ink">Quests &amp; Achievements</h1>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              Complete quests in order to earn points. Quests stay locked until the previous one is done.
            </p>
          </div>
        </div>

        {!walletAddress && (
          <p className="mt-4 rounded-xl border border-surface-border bg-base px-4 py-3 text-[13px] text-ink-muted">
            Connect your Sphere Wallet to start tracking quest progress.
          </p>
        )}

        <div className="mt-5 flex items-center justify-between rounded-xl border border-surface-border bg-base px-4 py-3.5">
          <div>
            <p className="m-0 text-[13px] text-ink-muted">Progress</p>
            <p className="m-0 text-[15px] font-semibold text-ink">
              {completedCount} / {quests.length} quests completed
            </p>
          </div>
          <div className="text-right">
            <p className="m-0 text-[13px] text-ink-muted">Points</p>
            <p className="m-0 text-[15px] font-semibold text-ink">
              {totalPoints} / {maxPoints}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-5 text-[13px] text-ink-muted">Loading quests...</p>
        ) : error ? (
          <p className="mt-5 text-[13px] text-danger">{error}</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-ink-muted">
                  <th className="w-8 py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">Quest</th>
                  <th className="py-2 pr-3 font-semibold">Points</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {quests.map((q) => {
                  const rowDim = !q.unlocked && !q.completed
                  return (
                    <tr
                      key={q.quest_id}
                      className={`border-b border-surface-border last:border-0 ${rowDim ? 'opacity-45' : ''}`}
                    >
                      <td className="py-3 pr-3 align-top text-ink-muted">{q.order_index}</td>
                      <td className="py-3 pr-3 align-top">
                        <p className="m-0 font-semibold text-ink">{q.title}</p>
                        <p className="m-0 mt-0.5 text-ink-muted">{q.description}</p>
                      </td>
                      <td className="py-3 pr-3 align-top text-ink">{q.points}</td>
                      <td className="py-3 pr-3 align-top">
                        {q.completed ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Completed
                          </span>
                        ) : q.unlocked ? (
                          <span className="inline-flex items-center rounded-full bg-surface-hover px-2.5 py-1 text-[12px] font-semibold text-ink-muted">
                            Unlocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-surface-hover px-2.5 py-1 text-[12px] font-semibold text-ink-faint">
                            Locked
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[12px] text-ink-faint">
          Total {maxPoints} points, split 7 easy / 2 medium / 1 hard. Progress is recorded on the server when the
          related action succeeds (not via an external webhook -- this app has no separate backend).
        </p>
      </div>
    </div>
  )
}
