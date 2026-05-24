import { corsHeaders, getAuthenticatedUser, jsonResponse } from '../_shared/account.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { supabase, user } = await getAuthenticatedUser(req);
    const { error } = await supabase
      .from('profiles')
      .update({
        account_status: 'active',
        deactivated_at: null,
        deletion_scheduled_at: null,
        deletion_due_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);
    if (error) throw error;

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Restore failed' }, { status: 400 });
  }
});
