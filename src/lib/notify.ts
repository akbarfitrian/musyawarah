import { supabase } from '../supabaseClient'

export async function notifyFollow(actorWallet: string, recipientWallet: string) {
  try {
    const { error } = await supabase.from('notifications').insert({
      recipient_wallet: recipientWallet,
      actor_wallet: actorWallet,
      type: 'follow',
    })
    if (error) throw error
  } catch (e) {
    console.warn('[MUSYAWARAH] Gagal bikin notifikasi follow:', e)
  }
}

export async function removeFollowNotification(actorWallet: string, recipientWallet: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('recipient_wallet', recipientWallet)
      .eq('actor_wallet', actorWallet)
      .eq('type', 'follow')
    if (error) throw error
  } catch (e) {
    console.warn('[MUSYAWARAH] Gagal hapus notifikasi follow (unfollow):', e)
  }
}

export async function notifyRepost(actorWallet: string, recipientWallet: string, postId: string) {
  if (actorWallet === recipientWallet) return
  try {
    const { error } = await supabase.from('notifications').insert({
      recipient_wallet: recipientWallet,
      actor_wallet: actorWallet,
      type: 'repost',
      post_id: postId,
    })
    if (error) throw error
  } catch (e) {
    console.warn('[MUSYAWARAH] Gagal bikin notifikasi repost:', e)
  }
}

export async function removeRepostNotification(actorWallet: string, postId: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('actor_wallet', actorWallet)
      .eq('post_id', postId)
      .eq('type', 'repost')
    if (error) throw error
  } catch (e) {
    console.warn('[MUSYAWARAH] Gagal hapus notifikasi repost (undo):', e)
  }
}

export async function notifyTip(actorWallet: string, recipientWallet: string, postId: string, amount: number) {
  if (actorWallet === recipientWallet) return
  try {
    const { error } = await supabase.from('notifications').insert({
      recipient_wallet: recipientWallet,
      actor_wallet: actorWallet,
      type: 'tip',
      post_id: postId,
      amount,
    })
    if (error) throw error
  } catch (e) {
    console.warn('[MUSYAWARAH] Gagal bikin notifikasi tip:', e)
  }
}
