import { corsHeaders, getAuthenticatedUser, getUserCoupleIds, jsonResponse } from '../_shared/account.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { supabase, user } = await getAuthenticatedUser(req);
    const coupleIds = await getUserCoupleIds(supabase, user.id);

    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    const { data: visits } = coupleIds.length
      ? await supabase.from('prefecture_visits').select('*, photos(*), visit_comments(*)').in('couple_id', coupleIds).order('visited_on', { ascending: false })
      : { data: [] };
    const { data: wishlist } = coupleIds.length
      ? await supabase.from('wishlist').select('*').in('couple_id', coupleIds).order('created_at', { ascending: false })
      : { data: [] };
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .or(`recipient_user_id.eq.${user.id},actor_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    const visitsWithPhotoUrls = await Promise.all(
      (visits ?? []).map(async (visit) => ({
        ...visit,
        photos: await Promise.all(
          (visit.photos ?? []).map(async (photo) => {
            const { data } = await supabase.storage.from('travel-photos').createSignedUrl(photo.storage_path, 60 * 60);
            return { ...photo, download_url: data?.signedUrl ?? null };
          }),
        ),
      })),
    );

    return jsonResponse({
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
      },
      profile,
      couple_ids: coupleIds,
      visits: visitsWithPhotoUrls,
      wishlist: wishlist ?? [],
      notifications: notifications ?? [],
      note: '写真ファイルは各photo.download_urlから1時間以内にダウンロードできます。ZIP化は次段階で追加できます。',
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Export failed' }, { status: 400 });
  }
});
