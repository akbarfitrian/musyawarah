import { supabase } from '../supabaseClient'

// ============================================================================
// NOTIFIKASI
// ----------------------------------------------------------------------------
// SUDAH TIDAK DIPAKAI buat follow/repost/tip (per supabase/002_harden_
// writes.sql). Notifikasi buat ketiga aksi itu sekarang dibikin/dihapus DI
// DALAM Postgres function-nya sendiri (toggle_follow, toggle_repost,
// send_tip) biar atomik sama aksi utamanya dan gak bisa dilewatin lewat REST
// API mentah -- lihat file SQL itu, bukan function-function di bawah ini.
//
// File ini sengaja DIBIARIN (bukan dihapus) sebagai referensi/kalau nanti
// ada fitur notifikasi baru dari client yang butuh pola serupa. Fungsi di
// bawah sekarang jadi dead code buat 3 fitur itu -- jangan diimpor lagi buat
// follow/repost/tip.
// ============================================================================

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

/** Dipanggil pas unfollow -- notif follow yang lama harus ikut hilang. */
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
  if (actorWallet === recipientWallet) return // jaga-jaga, walau UI udah nyegah repost post sendiri
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

/** Dipanggil pas undo repost -- notif repost yang lama harus ikut hilang. */
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
  if (actorWallet === recipientWallet) return // jaga-jaga, walau UI udah nyegah tip post sendiri
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
