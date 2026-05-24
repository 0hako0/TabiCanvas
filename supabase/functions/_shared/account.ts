import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

export function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) throw new Error('Missing authorization token');
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid authorization token');
  return { supabase, user: data.user };
}

export async function getUserCoupleIds(supabase: ReturnType<typeof getAdminClient>, userId: string) {
  const { data, error } = await supabase.from('couple_members').select('couple_id').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.couple_id as string);
}

export async function notifyOtherMembers(
  supabase: ReturnType<typeof getAdminClient>,
  userId: string,
  title: string,
  message: string,
) {
  const coupleIds = await getUserCoupleIds(supabase, userId);
  if (coupleIds.length === 0) return;
  const { data: members, error } = await supabase
    .from('couple_members')
    .select('couple_id, user_id')
    .in('couple_id', coupleIds)
    .neq('user_id', userId);
  if (error) throw error;
  const notifications = (members ?? []).map((member) => ({
    couple_id: member.couple_id,
    recipient_user_id: member.user_id,
    actor_user_id: userId,
    type: 'account_status',
    title,
    message,
  }));
  if (notifications.length > 0) {
    const { error: notificationError } = await supabase.from('notifications').insert(notifications);
    if (notificationError) throw notificationError;
  }
}
