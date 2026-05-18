import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Camera,
  CalendarDays,
  Clock,
  Home,
  ImagePlus,
  ListTodo,
  Loader2,
  LogOut,
  Map as MapIcon,
  Plus,
  Settings,
  Trophy,
  X,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthScreen } from './components/AuthScreen';
import { BadgePanel } from './components/BadgePanel';
import { CoupleSetup } from './components/CoupleSetup';
import { JapanMap } from './components/JapanMap';
import { StatsPanel } from './components/StatsPanel';
import { TimelinePanel } from './components/TimelinePanel';
import { WishlistPanel } from './components/WishlistPanel';
import { PREFECTURES } from './data/prefectures';
import { resizeImage } from './lib/image';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import type {
  Couple,
  Prefecture,
  PrefectureVisit,
  Profile,
  VisitFormState,
  VisitComment,
  VisitPhoto,
  WishlistFormState,
  WishlistItem,
} from './types';

const defaultForm: VisitFormState = {
  visited_on: new Date().toISOString().slice(0, 10),
  place_name: '',
  memo: '',
  nights: 0,
  tags: '',
};

const defaultWishlistForm: WishlistFormState = {
  title: '',
  food: '',
  sightseeing: '',
  memo: '',
};

function resetMobileZoom() {
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!viewport) return;

  viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0');
  window.scrollTo({ top: window.scrollY, left: 0 });

  window.setTimeout(() => {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
  }, 250);
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [nickname, setNickname] = useState('');
  const [visits, setVisits] = useState<PrefectureVisit[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [selected, setSelected] = useState<Prefecture>(PREFECTURES[0]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeMobileView, setActiveMobileView] = useState<'home' | 'map' | 'plan' | 'timeline'>('home');
  const [editingVisit, setEditingVisit] = useState<PrefectureVisit | null>(null);
  const [form, setForm] = useState<VisitFormState>(defaultForm);
  const [wishlistForm, setWishlistForm] = useState<WishlistFormState>(defaultWishlistForm);
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    loadCoupleAndVisits();
  }, [session]);

  async function loadCoupleAndVisits() {
    setLoading(true);
    setMessage('');
    const { data: ownProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session!.user.id)
      .maybeSingle();
    setProfile((ownProfile as Profile | null) ?? null);
    setNickname((ownProfile as Profile | null)?.nickname ?? '');

    const { data: member, error: memberError } = await supabase
      .from('couple_members')
      .select('couple_id, couples(id, name, invite_code)')
      .eq('user_id', session!.user.id)
      .maybeSingle();

    if (memberError) setMessage(memberError.message);
    const nextCouple = Array.isArray(member?.couples) ? member.couples[0] : member?.couples;
    setCouple((nextCouple as Couple | undefined) ?? null);

    if (member?.couple_id) {
      const { data: memberRows } = await supabase.from('couple_members').select('user_id').eq('couple_id', member.couple_id);
      const memberIds = (memberRows ?? []).map((row) => row.user_id);
      if (memberIds.length > 0) {
        const { data: profileRows } = await supabase.from('profiles').select('*').in('user_id', memberIds);
        setProfiles((profileRows as Profile[] | null) ?? []);
      }

      const { data, error } = await supabase
        .from('prefecture_visits')
        .select('*, photos(*), visit_comments(*)')
        .eq('couple_id', member.couple_id)
        .order('visited_on', { ascending: false });
      if (error) setMessage(error.message);
      setVisits(await attachSignedPhotoUrls((data as PrefectureVisit[] | null) ?? []));

      const { data: wishlist, error: wishlistError } = await supabase
        .from('wishlist')
        .select('*')
        .eq('couple_id', member.couple_id)
        .order('created_at', { ascending: false });
      if (wishlistError) setMessage(wishlistError.message);
      setWishlistItems((wishlist as WishlistItem[] | null) ?? []);
    }
    setLoading(false);
  }

  const visitCounts = useMemo(() => {
    return visits.reduce<Map<number, number>>((map, visit) => {
      map.set(visit.prefecture_id, (map.get(visit.prefecture_id) ?? 0) + 1);
      return map;
    }, new Map());
  }, [visits]);

  const selectedVisits = visits.filter((visit) => visit.prefecture_id === selected.id);
  const selectedWishlistItems = wishlistItems.filter((item) => item.prefecture_id === selected.id);
  const visitedIds = useMemo(() => new Set(visits.map((visit) => visit.prefecture_id)), [visits]);
  const completionRate = Math.round((visitedIds.size / 47) * 100);
  const topPrefecture = useMemo(() => {
    const top = [...visitCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? PREFECTURES.find((prefecture) => prefecture.id === top[0])?.name ?? 'これから' : 'これから';
  }, [visitCounts]);
  const recentVisits = visits.slice(0, 5);
  const selectedPreviewPhotos = selectedVisits.flatMap((visit) => visit.photos ?? []).slice(0, 4);

  function handlePrefectureSelect(prefecture: Prefecture) {
    setSelected(prefecture);
    setActiveMobileView('timeline');
  }

  function openEditorForSelected() {
    resetMobileZoom();
    setEditingVisit(null);
    setForm(defaultForm);
    setFiles(null);
    setIsEditorOpen(true);
  }

  function openEditorForPrefecture(prefecture: Prefecture) {
    resetMobileZoom();
    setSelected(prefecture);
    setEditingVisit(null);
    setForm(defaultForm);
    setFiles(null);
    setIsEditorOpen(true);
  }

  function goToMobileView(view: 'home' | 'map' | 'plan' | 'timeline') {
    setActiveMobileView(view);
  }

  function previewPrefecture(prefecture: Prefecture) {
    setSelected(prefecture);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!couple) return;
    setSaving(true);
    setMessage('');

    const payload = {
      couple_id: couple.id,
      prefecture_id: selected.id,
      visited_on: form.visited_on,
      place_name: form.place_name,
      memo: form.memo || null,
      nights: form.nights,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    const query = editingVisit
      ? supabase.from('prefecture_visits').update(payload).eq('id', editingVisit.id)
      : supabase.from('prefecture_visits').insert(payload);

    const { data: visit, error } = await query
      .select()
      .single();

    if (error) {
      setSaving(false);
      setMessage(error.message);
      return;
    }

    if (files?.length) {
      await uploadPhotos(visit.id, files);
    }

    setForm(defaultForm);
    setFiles(null);
    setEditingVisit(null);
    setIsEditorOpen(false);
    await loadCoupleAndVisits();
    setSaving(false);
  }

  function editVisit(visit: PrefectureVisit) {
    resetMobileZoom();
    const prefecture = PREFECTURES.find((item) => item.id === visit.prefecture_id);
    if (prefecture) setSelected(prefecture);
    setEditingVisit(visit);
    setForm({
      visited_on: visit.visited_on,
      place_name: visit.place_name,
      memo: visit.memo ?? '',
      nights: visit.nights,
      tags: visit.tags.join(', '),
    });
    setFiles(null);
    setIsEditorOpen(true);
  }

  async function uploadPhotos(visitId: string, uploadFiles: FileList) {
    if (!couple) return;
    for (const file of Array.from(uploadFiles)) {
      const compressed = await resizeImage(file);
      const path = `${couple.id}/${visitId}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from('travel-photos').upload(path, compressed, {
        contentType: 'image/webp',
      });
      if (uploadError) {
        setMessage(uploadError.message);
        continue;
      }
      await supabase.from('photos').insert({
        couple_id: couple.id,
        visit_id: visitId,
        storage_path: path,
      });
    }
  }

  async function attachSignedPhotoUrls(nextVisits: PrefectureVisit[]) {
    return Promise.all(
      nextVisits.map(async (visit) => ({
        ...visit,
        photos: await Promise.all(
          (visit.photos ?? []).map(async (photo) => {
            const { data } = await supabase.storage
              .from('travel-photos')
              .createSignedUrl(photo.storage_path, 60 * 60);
            return { ...photo, public_url: data?.signedUrl ?? null };
          }),
        ),
      })),
    );
  }

  async function deleteVisit(visitId: string) {
    if (!confirm('この旅行記録を削除しますか？')) return;
    const { error } = await supabase.from('prefecture_visits').delete().eq('id', visitId);
    if (error) setMessage(error.message);
    await loadCoupleAndVisits();
  }

  async function deletePhoto(photo: VisitPhoto) {
    if (!confirm('この写真を削除しますか？')) return;
    await supabase.storage.from('travel-photos').remove([photo.storage_path]);
    await supabase.from('photos').delete().eq('id', photo.id);
    await loadCoupleAndVisits();
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    setFiles(event.target.files);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!session || !nickname.trim()) return;
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ user_id: session.user.id, nickname: nickname.trim() })
      .select()
      .single();
    if (error) {
      setMessage(error.message);
      return;
    }
    setProfile(data as Profile);
    await loadCoupleAndVisits();
  }

  async function handleWishlistSubmit(event: FormEvent) {
    event.preventDefault();
    if (!couple) return;
    const { error } = await supabase.from('wishlist').insert({
      couple_id: couple.id,
      prefecture_id: selected.id,
      title: wishlistForm.title,
      food: wishlistForm.food || null,
      sightseeing: wishlistForm.sightseeing || null,
      memo: wishlistForm.memo || null,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setWishlistForm(defaultWishlistForm);
    await loadCoupleAndVisits();
  }

  async function deleteWishlistItem(itemId: string) {
    const { error } = await supabase.from('wishlist').delete().eq('id', itemId);
    if (error) setMessage(error.message);
    await loadCoupleAndVisits();
  }

  async function saveComment(visit: PrefectureVisit, body: string, existingComment?: VisitComment) {
    if (!couple || !session) return;
    const payload = {
      couple_id: couple.id,
      visit_id: visit.id,
      user_id: session.user.id,
      comment_type: 'comment',
      body,
    };
    const { error } = existingComment
      ? await supabase.from('visit_comments').update({ body }).eq('id', existingComment.id)
      : await supabase.from('visit_comments').insert(payload);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadCoupleAndVisits();
  }

  async function deleteComment(commentId: string) {
    const { error } = await supabase.from('visit_comments').delete().eq('id', commentId);
    if (error) setMessage(error.message);
    await loadCoupleAndVisits();
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Supabase設定が必要です</h1>
          <p className="lead">`.env.local` にSupabase URLとAnon Keyを設定してください。</p>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" />
        <span>旅の記録を読み込み中...</span>
      </main>
    );
  }

  if (!session) return <AuthScreen />;
  if (!profile) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Profile</p>
          <h1>ニックネーム登録</h1>
          <p className="lead">コメントや共有画面で表示する名前です。あとから変更できます。</p>
          <form className="stack" onSubmit={saveProfile}>
            <label>
              ニックネーム
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="例: 太郎" required />
            </label>
            <button className="primary-button">保存する</button>
          </form>
          {message && <p className="form-message">{message}</p>}
        </section>
      </main>
    );
  }
  if (!couple) return <CoupleSetup onReady={loadCoupleAndVisits} />;

  return (
    <main className="page-shell">
      <header className="app-header">
        <div>
          <h1>TabiCanvas</h1>
          <p>
            {profile.nickname}でログイン中 / 招待コード: <strong>{couple.invite_code}</strong>
          </p>
        </div>
        <button className="icon-button" aria-label="ログアウト" onClick={() => supabase.auth.signOut()}>
          <LogOut size={20} />
        </button>
      </header>

      {message && <p className="notice">{message}</p>}

      <section className="desktop-album-layout">
        <aside className="desktop-sidebar">
          <div className="desktop-brand">
            <h2>TabiCanvas</h2>
            <p>旅の思い出を、日本地図に描こう</p>
          </div>
          <nav className="desktop-nav" aria-label="PCナビゲーション">
            <button className="is-active">
              <Home size={19} />
              ホーム
            </button>
            <button onClick={() => setSelected(selected)}>
              <MapIcon size={19} />
              地図
            </button>
            <button>
              <Camera size={19} />
              思い出
            </button>
            <button>
              <ListTodo size={19} />
              計画
            </button>
            <button>
              <Award size={19} />
              バッジ
            </button>
            <button onClick={() => supabase.auth.signOut()}>
              <Settings size={19} />
              設定
            </button>
          </nav>
          <div className="desktop-sidebar-art" aria-hidden="true">
            <Camera size={42} />
            <span>Journey Memories</span>
          </div>
        </aside>

        <section className="desktop-map-stage">
          <div className="desktop-greeting">
            <div>
              <p className="eyebrow">Travel album</p>
              <h2>こんにちは、{profile.nickname}さん</h2>
              <p>地図をなぞるように、旅の記録を振り返りましょう。</p>
            </div>
            <button className="primary-button" onClick={openEditorForSelected}>
              <Plus size={18} />
              {selected.name}を記録
            </button>
          </div>

          <StatsPanel visits={visits} />

          <section className="desktop-map-card">
            <div className="desktop-map-copy">
              <p className="eyebrow">Japan map</p>
              <h2>47都道府県マップ</h2>
              <p>県にカーソルを合わせると右のアルバムが切り替わります。クリックすると記録を追加できます。</p>
            </div>
            <JapanMap
              selectedId={selected.id}
              visitCounts={visitCounts}
              onPreview={previewPrefecture}
              onSelect={openEditorForPrefecture}
            />
            <div className="desktop-hover-card">
              <div>
                <strong>{selected.name}</strong>
                <span>{selectedVisits.length}件の思い出</span>
              </div>
              <div className="desktop-hover-photos">
                {selectedPreviewPhotos.length ? (
                  selectedPreviewPhotos.map((photo) => <img key={photo.id} src={photo.public_url ?? ''} alt={`${selected.name}の写真`} />)
                ) : (
                  <p>写真はまだありません</p>
                )}
              </div>
            </div>
          </section>

          <BadgePanel visits={visits} />
        </section>

        <aside className="desktop-album-panel">
          <section className="panel desktop-panel-block">
            <div className="section-title">
              <Camera size={18} />
              <h2>最近の思い出</h2>
            </div>
            <div className="desktop-polaroid-list">
              {recentVisits.length ? (
                recentVisits.slice(0, 3).map((visit) => {
                  const pref = PREFECTURES.find((item) => item.id === visit.prefecture_id);
                  const photo = visit.photos?.[0];
                  return (
                    <article key={visit.id} className="desktop-polaroid" onClick={() => editVisit(visit)}>
                      {photo?.public_url ? <img src={photo.public_url} alt={`${visit.place_name}の写真`} /> : <div className="desktop-photo-placeholder" />}
                      <div>
                        <strong>{visit.place_name}</strong>
                        <span>{pref?.name} / {visit.visited_on}</span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="empty compact">まだ思い出がありません。地図から県をクリックして記録しましょう。</p>
              )}
            </div>
          </section>

          <WishlistPanel
            selected={selected}
            items={selectedWishlistItems}
            form={wishlistForm}
            onFormChange={setWishlistForm}
            onSubmit={handleWishlistSubmit}
            onDelete={deleteWishlistItem}
          />

          <section className="panel desktop-panel-block">
            <div className="section-title">
              <CalendarDays size={18} />
              <h2>旅の記録タイムライン</h2>
            </div>
            <div className="desktop-mini-timeline">
              {recentVisits.length ? (
                recentVisits.map((visit) => {
                  const pref = PREFECTURES.find((item) => item.id === visit.prefecture_id);
                  return (
                    <button key={visit.id} onClick={() => editVisit(visit)}>
                      <span>{visit.visited_on}</span>
                      <strong>{pref?.name}・{visit.place_name}</strong>
                    </button>
                  );
                })
              ) : (
                <p className="empty compact">旅の記録はまだありません。</p>
              )}
            </div>
          </section>
        </aside>
      </section>

      <section className={`mobile-section mobile-home-section ${activeMobileView === 'home' ? 'is-active' : ''}`}>
        <section className="mobile-summary-card panel">
          <div>
            <p className="eyebrow">YOUR JOURNEY</p>
            <h2>旅の進み具合</h2>
          </div>
          <div className="mobile-summary-grid">
            <div>
              <Trophy size={20} />
              <span>制覇率</span>
              <strong>{visitedIds.size}/47県</strong>
              <small>{completionRate}% 達成</small>
            </div>
            <div>
              <MapIcon size={20} />
              <span>旅行回数</span>
              <strong>{visits.length}回</strong>
            </div>
            <div>
              <Camera size={20} />
              <span>一番行った県</span>
              <strong>{topPrefecture}</strong>
            </div>
          </div>
          <div className="progress-track">
            <div style={{ width: `${completionRate}%` }} />
          </div>
        </section>

        <section className="mobile-map-preview panel">
          <div className="section-title">
            <MapIcon size={18} />
            <h2>47都道府県マップ</h2>
          </div>
          <JapanMap selectedId={selected.id} visitCounts={visitCounts} onSelect={handlePrefectureSelect} />
        </section>

        <section className="mobile-memory-cta panel">
          <Camera size={28} />
          <div>
            <strong>思い出を記録して地図をカラフルにしていこう</strong>
            <p>{selected.name}を選択中です。</p>
          </div>
          <button className="primary-button" onClick={openEditorForSelected}>
            <Plus size={18} />
            追加
          </button>
        </section>
      </section>

      <nav className="mobile-view-tabs" aria-label="表示切り替え">
        <button className={activeMobileView === 'map' ? 'is-active' : ''} onClick={() => setActiveMobileView('map')}>
          <MapIcon size={18} />
          地図
        </button>
        <button className={activeMobileView === 'plan' ? 'is-active' : ''} onClick={() => setActiveMobileView('plan')}>
          <ListTodo size={18} />
          計画
        </button>
        <button className={activeMobileView === 'timeline' ? 'is-active' : ''} onClick={() => setActiveMobileView('timeline')}>
          <Clock size={18} />
          思い出
        </button>
      </nav>

      <section className={`mobile-section ${activeMobileView === 'map' ? 'is-active' : ''}`}>
        <StatsPanel visits={visits} />
        <BadgePanel visits={visits} />

        <section className="map-layout">
          <aside className="prefecture-list panel" aria-label="都道府県一覧">
            <div className="section-title">
              <MapIcon size={18} />
              <h2>都道府県一覧</h2>
            </div>
            <div className="prefecture-list-grid">
              {PREFECTURES.map((prefecture) => {
                const count = visitCounts.get(prefecture.id) ?? 0;
                const isSelected = selected.id === prefecture.id;
                return (
                  <button
                    key={prefecture.id}
                    className={`prefecture-list-button ${isSelected ? 'is-selected' : ''} ${count > 0 ? 'is-visited' : ''}`}
                    onMouseEnter={() => previewPrefecture(prefecture)}
                    onFocus={() => previewPrefecture(prefecture)}
                    onClick={() => handlePrefectureSelect(prefecture)}
                  >
                    <span>{prefecture.name}</span>
                    {count > 0 && <strong>{count}</strong>}
                  </button>
                );
              })}
            </div>
          </aside>
          <JapanMap selectedId={selected.id} visitCounts={visitCounts} onSelect={handlePrefectureSelect} />
        </section>
      </section>

      <section className={`mobile-section ${activeMobileView === 'plan' ? 'is-active' : ''}`}>
        <section className="detail-grid">
          <WishlistPanel
            selected={selected}
            items={selectedWishlistItems}
            form={wishlistForm}
            onFormChange={setWishlistForm}
            onSubmit={handleWishlistSubmit}
            onDelete={deleteWishlistItem}
          />
          <section className="panel selected-memory-panel">
            <div className="section-title">
              <Plus size={18} />
              <h2>{selected.name}の記録</h2>
            </div>
            <p className="empty compact">
              {selectedVisits.length > 0
                ? `${selected.name}には${selectedVisits.length}件の思い出があります。思い出タブで見返せます。`
                : 'まだ記録がありません。まず県を選び、下のボタンから思い出を追加できます。'}
            </p>
            <button className="primary-button add-memory-button" onClick={openEditorForSelected}>
              <Plus size={18} />
              {selected.name}の記録を追加
            </button>
          </section>
        </section>
      </section>

      <section className={`mobile-section ${activeMobileView === 'timeline' ? 'is-active' : ''}`}>
        <TimelinePanel
          visits={visits}
          selected={selected}
          currentUserId={session.user.id}
          profiles={profiles}
          onEditVisit={editVisit}
          onDeleteVisit={deleteVisit}
          onSaveComment={saveComment}
          onDeleteComment={deleteComment}
        />
      </section>

      <nav className="mobile-bottom-nav" aria-label="メインナビゲーション">
        <button className={activeMobileView === 'home' ? 'is-active' : ''} onClick={() => goToMobileView('home')}>
          <Home size={20} />
          <span>ホーム</span>
        </button>
        <button className={activeMobileView === 'map' ? 'is-active' : ''} onClick={() => goToMobileView('map')}>
          <MapIcon size={20} />
          <span>地図</span>
        </button>
        <button className="mobile-add-button" aria-label="記録を追加" onClick={openEditorForSelected}>
          <Plus size={30} />
        </button>
        <button className={activeMobileView === 'plan' ? 'is-active' : ''} onClick={() => goToMobileView('plan')}>
          <ListTodo size={20} />
          <span>計画</span>
        </button>
        <button className={activeMobileView === 'timeline' ? 'is-active' : ''} onClick={() => goToMobileView('timeline')}>
          <Clock size={20} />
          <span>思い出</span>
        </button>
      </nav>

      {isEditorOpen && (
        <div className="editor-backdrop" role="dialog" aria-modal="true" aria-label={`${selected.name}の旅行記録`}>
          <aside className="panel editor-panel">
            <div className="editor-panel-head">
              <div className="section-title">
                <Plus size={18} />
                <h2>{editingVisit ? `${selected.name}の記録を編集` : `${selected.name}を記録`}</h2>
              </div>
              <button className="icon-button small" aria-label="閉じる" onClick={() => setIsEditorOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="stack">
              <label>
                行った日
                <input
                  type="date"
                  value={form.visited_on}
                  onChange={(event) => setForm({ ...form, visited_on: event.target.value })}
                  required
                />
              </label>
              <label>
                行った場所
                <input
                  value={form.place_name}
                  onChange={(event) => setForm({ ...form, place_name: event.target.value })}
                  placeholder="例: 道後温泉、軽井沢キャンプ場"
                  required
                />
              </label>
              <label>
                メモ
                <textarea
                  value={form.memo}
                  onChange={(event) => setForm({ ...form, memo: event.target.value })}
                  placeholder="食べたもの、景色、ふたりの会話など"
                  rows={4}
                />
              </label>
              <label>
                タグ カンマ区切り
                <input
                  value={form.tags}
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                  placeholder="温泉, 記念日, キャンプ"
                />
              </label>
              <label>
                宿泊数
                <input
                  type="number"
                  min="0"
                  value={form.nights}
                  onChange={(event) => setForm({ ...form, nights: Number(event.target.value) })}
                />
              </label>
              <label className="file-drop">
                <ImagePlus size={24} />
                <span>{files?.length ? `${files.length}枚選択中` : '写真を選択'}</span>
                <input type="file" accept="image/*" multiple onChange={handleFiles} />
              </label>
              <button className="primary-button" disabled={saving}>
                {saving ? <Loader2 className="spin" size={18} /> : <Camera size={18} />}
                {editingVisit ? '更新する' : '保存する'}
              </button>
            </form>
          </aside>
        </div>
      )}
    </main>
  );
}
