import { corsHeaders, getAuthenticatedUser, jsonResponse, notifyOtherMembers } from '../_shared/account.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { supabase, user } = await getAuthenticatedUser(req);
    const { data: profile } = await supabase.from('profiles').select('nickname').eq('user_id', user.id).maybeSingle();
    const nickname = profile?.nickname ?? 'メンバー';

    await notifyOtherMembers(supabase, user.id, `${nickname}さんがTabiCanvasを退会しました`, 'アカウントと本人が作成したデータが削除されました。');

    const { data: ownPhotos } = await supabase.from('photos').select('storage_path').eq('created_by', user.id);
    const paths = (ownPhotos ?? []).map((photo) => photo.storage_path as string);
    if (paths.length > 0) {
      await supabase.storage.from('travel-photos').remove(paths);
    }

    await supabase.from('photos').delete().eq('created_by', user.id);
    await supabase.from('visit_comments').delete().eq('user_id', user.id);
    await supabase.from('wishlist').delete().eq('created_by', user.id);
    await supabase.from('prefecture_visits').delete().eq('created_by', user.id);
    await supabase.from('notifications').delete().eq('recipient_user_id', user.id);
    await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
    await supabase.from('couple_members').delete().eq('user_id', user.id);
    await supabase.from('profiles').delete().eq('user_id', user.id);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Delete failed' }, { status: 400 });
  }
});
