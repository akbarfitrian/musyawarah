import { usePost } from '../hooks/usePost'
import { postPath } from '../utils/routes'
import { PostCard } from './PostCard'
import { CopyLinkButton } from './CopyLinkButton'
import { ChevronLeftIcon } from './icons'

/** Halaman permalink buat satu post -- alamatnya sendiri (#/post/:id), bisa
 * di-copy/share/bookmark, sama kayak halaman /status/123 di X/Twitter. */
export function PostPage({
  postId,
  onBack,
  onVisitProfile,
  onMessageProvider,
  onChanged,
}: {
  postId: string
  onBack: () => void
  onVisitProfile?: (walletAddress: string) => void
  onMessageProvider?: (walletAddress: string) => void
  onChanged: () => void
}) {
  const { post, loading, error, notFound, refresh } = usePost(postId)

  return (
    <div>
      <div className="flex items-center justify-between px-1 py-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-[14px] font-medium text-ink-muted transition-colors hover:text-ink"
          onClick={onBack}
        >
          <ChevronLeftIcon size={16} />
          Back
        </button>
        <CopyLinkButton path={postPath(postId)} label="Copy link to post" className="h-8 w-8" />
      </div>

      {loading ? (
        <p className="py-16 text-center text-[13px] text-ink-muted">Loading post…</p>
      ) : error ? (
        <p className="py-16 text-center text-[13px] text-danger">{error}</p>
      ) : notFound || !post ? (
        <p className="py-16 text-center text-[13px] text-ink-muted">This post doesn't exist or was deleted.</p>
      ) : (
        <PostCard
          post={post}
          onTipped={() => {
            refresh()
            onChanged()
          }}
          onDeleted={() => {
            onChanged()
            onBack()
          }}
          onVisitProfile={onVisitProfile}
          onMessageProvider={onMessageProvider}
        />
      )}
    </div>
  )
}
