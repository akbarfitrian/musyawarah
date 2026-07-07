import type { Post } from '../types'
import { PostCard } from './PostCard'

export function Feed({
  posts,
  loading,
  error,
  onTipped,
  onDeleted,
  onVisitProfile,
  emptyMessage,
  highlightPostId,
}: {
  posts: Post[]
  loading: boolean
  error: string | null
  onTipped: () => void
  onDeleted: () => void
  onVisitProfile?: (walletAddress: string) => void
  emptyMessage?: string
  /** post_id yang harus di-scroll-ke dan disorot (mis. abis klik "Trending"
   * di RightPanel.tsx). */
  highlightPostId?: string | null
}) {
  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-16">
        <p className="text-sm text-ink-muted">Loading feed…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center px-4 py-16">
        <p className="text-sm text-danger">{error}</p>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-16 text-center">
        <p className="text-sm text-ink-muted">{emptyMessage ?? 'No posts yet. Be the first.'}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onTipped={onTipped}
          onDeleted={onDeleted}
          onVisitProfile={onVisitProfile}
          highlighted={post.id === highlightPostId}
        />
      ))}
    </div>
  )
}
