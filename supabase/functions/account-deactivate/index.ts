import { corsHeaders, getAuthenticatedUser, jsonResponse, notifyOtherMembers } from '../_shared/account.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { supabase, user } = await getAuthenticatedUser(req);
    const now = new Date();
    const due = new Date(now);
    due.setDate(due.getDate() + 30);

    const { data: profile } = await supabase.from('profiles').select('nickname').eq('user_id', user.id).maybeSingle();
    const nickname = profile?.nickname ?? 'メンバー';

    const { error } = await supabase
      .from('profiles')
      .update({
        account_status: 'scheduled_for_deletion',
        deactivated_at: now.toISOString(),
        deletion_scheduled_at: now.toISOString(),
        deletion_due_at: due.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', user.id);
    if (error) throw error;

    await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
    await notifyOtherMembers(supabase, user.id, `${nickname}さんがアカウントを停止しました`, '30日以内であれば復元できます。');

    return jsonResponse({ ok: true, deletion_due_at: due.toISOString() });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Deactivate failed' }, { status: 400 });
  }
});
