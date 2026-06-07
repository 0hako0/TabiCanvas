import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Bell,
  Camera,
  CalendarDays,
  CheckCheck,
  Clock,
  Home,
  ImagePlus,
  ListTodo,
  Loader2,
  LogOut,
  Map as MapIcon,
  Plus,
  Search,
  Settings,
  Trophy,
  X,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AccountManagement } from './components/AccountManagement';
import { AuthScreen } from './components/AuthScreen';
import { BadgePanel } from './components/BadgePanel';
import { CoupleSetup } from './components/CoupleSetup';
import { JapanMap } from './components/JapanMap';
import { MapPhotoCollage } from './components/MapPhotoCollage';
import { StatsPanel } from './components/StatsPanel';
import { TimelinePanel } from './components/TimelinePanel';
import { WishlistPanel } from './components/WishlistPanel';
import { PREFECTURES, REGIONS } from './data/prefectures';
import { resizeImage, resizeThumbnail } from './lib/image';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import type {
  AppNotification,
  Couple,
  Prefecture,
  PrefectureVisit,
  Profile,
  UserSettings,
  VisitFormState,
  VisitPhoto,
  WishlistFormState,
  WishlistItem,
} from './types';

type MapCollagePhotoRow = {
  photo_id: string;
  visit_id: string;
  couple_id: string;
  storage_path: string;
  public_url: string | null;
  original_url: string | null;
  thumbnail_url: string | null;
  original_storage_path: string | null;
  thumbnail_storage_path: string | null;
  caption: string | null;
  prefecture_id: number;
  visited_on: string;
  place_name: string;
  memo: string | null;
  nights: number;
  tags: string[];
  visit_created_at: string;
};

const defaultForm: VisitFormState = {
  visited_on: new Date().toISOString().slice(0, 10),
  place_name: '',
  memo: '',
  comment: '',
  nights: 0,
  tags: '',
};

const defaultWishlistForm: WishlistFormState = {
  title: '',
  food: '',
  sightseeing: '',
  memo: '',
};

const NO_PREFECTURE_SELECTED: Prefecture = {
  id: 0,
  name: '都道府県を選んでください',
  region: '',
  x: 0,
  y: 0,
};

const SIGNED_PHOTO_URL_TTL_MS = 55 * 60 * 1000;
const photoSignedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function getPhotoDisplayUrl(photo?: VisitPhoto | null) {
  if (!photo) return '';
  return photo.thumbnail_url ?? photo.public_url ?? photo.original_url ?? '';
}

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
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [nickname, setNickname] = useState('');
  const [visits, setVisits] = useState<PrefectureVisit[]>([]);
  const [mapCollageVisits, setMapCollageVisits] = useState<PrefectureVisit[]>([]);
  const [isMapCollageRefreshing, setIsMapCollageRefreshing] = useState(false);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [selectedPrefecture, setSelected] = useState<Prefecture | null>(null);
  const [hoveredPrefecture, setHoveredPrefecture] = useState<Prefecture | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPrefecturePickerOpen, setIsPrefecturePickerOpen] = useState(false);
  const [activeMobileView, setActiveMobileView] = useState<'home' | 'map' | 'plan' | 'timeline'>('home');
  const [isMapSheetOpen, setIsMapSheetOpen] = useState(false);
  const [mapFilter, setMapFilter] = useState<'all' | 'visited' | 'unvisited' | 'wishlist'>('all');
  const [editingVisit, setEditingVisit] = useState<PrefectureVisit | null>(null);
  const [form, setForm] = useState<VisitFormState>(defaultForm);
  const [wishlistForm, setWishlistForm] = useState<WishlistFormState>(defaultWishlistForm);
  const [files, setFiles] = useState<FileList | null>(null);
  const [prefectureSearch, setPrefectureSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isAccountManagementOpen, setIsAccountManagementOpen] = useState(false);
  const mapCollagePhotoIdsRef = useRef<string[]>([]);

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

  useEffect(() => {
    if (!couple?.id || activeMobileView !== 'map') return undefined;
    void loadMapCollagePhotos(couple.id, { excludePrevious: true });
    const timer = window.setInterval(() => {
      void loadMapCollagePhotos(couple.id, { animated: true, excludePrevious: true });
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [couple?.id, activeMobileView]);

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

    const defaultUserSettings: UserSettings = {
      user_id: session!.user.id,
      in_app_notifications_enabled: true,
      push_notifications_enabled: false,
    };
    const { data: settingsRow } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session!.user.id)
      .maybeSingle();
    const nextUserSettings = (settingsRow as UserSettings | null) ?? defaultUserSettings;
    setUserSettings(nextUserSettings);

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
      setMemberIds(memberIds);
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
      await loadMapCollagePhotos(member.couple_id);

      const { data: wishlist, error: wishlistError } = await supabase
        .from('wishlist')
        .select('*')
        .eq('couple_id', member.couple_id)
        .order('created_at', { ascending: false });
      if (wishlistError) setMessage(wishlistError.message);
      setWishlistItems((wishlist as WishlistItem[] | null) ?? []);
      if (nextUserSettings.in_app_notifications_enabled === false) {
        setNotifications([]);
      } else {
        const { data: notificationRows, error: notificationError } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_user_id', session!.user.id)
          .order('created_at', { ascending: false })
          .limit(30);
        if (notificationError) setMessage(notificationError.message);
        setNotifications((notificationRows as AppNotification[] | null) ?? []);
      }
    } else {
      setMemberIds([]);
      setMapCollageVisits([]);
      setNotifications([]);
    }
    setLoading(false);
  }

  const visitCounts = useMemo(() => {
    return visits.reduce<Map<number, number>>((map, visit) => {
      map.set(visit.prefecture_id, (map.get(visit.prefecture_id) ?? 0) + 1);
      return map;
    }, new Map());
  }, [visits]);

  const selected = selectedPrefecture ?? NO_PREFECTURE_SELECTED;
  const selectedVisits = selectedPrefecture ? visits.filter((visit) => visit.prefecture_id === selectedPrefecture.id) : [];
  const selectedWishlistItems = selectedPrefecture ? wishlistItems.filter((item) => item.prefecture_id === selectedPrefecture.id) : [];
  const selectedSheetPhotos = selectedVisits
    .flatMap((visit) => (visit.photos ?? []).map((photo) => ({ photo, visit })))
    .slice(0, 8);
  const desktopPreviewPrefecture = hoveredPrefecture ?? selectedPrefecture;
  const desktopPreviewVisits = desktopPreviewPrefecture
    ? visits.filter((visit) => visit.prefecture_id === desktopPreviewPrefecture.id)
    : [];
  const visitedIds = useMemo(() => new Set(visits.map((visit) => visit.prefecture_id)), [visits]);
  const wishlistIds = useMemo(() => new Set(wishlistItems.map((item) => item.prefecture_id)), [wishlistItems]);
  const completionRate = Math.round((visitedIds.size / 47) * 100);
  const topPrefecture = useMemo(() => {
    const top = [...visitCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? PREFECTURES.find((prefecture) => prefecture.id === top[0])?.name ?? 'これから' : 'これから';
  }, [visitCounts]);
  const recentVisits = visits.slice(0, 5);
  const selectedPreviewPhotos = desktopPreviewVisits.flatMap((visit) => visit.photos ?? []).slice(0, 4);
  const selectedPhotoCount = selectedVisits.reduce((total, visit) => total + (visit.photos?.length ?? 0), 0);
  const latestSelectedVisit = selectedVisits[0];
  const nextWishlistItems = wishlistItems.slice(0, 3);
  const filteredPrefectureIds = useMemo(() => {
    if (mapFilter === 'visited') return visitedIds;
    if (mapFilter === 'unvisited') return new Set(PREFECTURES.filter((prefecture) => !visitedIds.has(prefecture.id)).map((prefecture) => prefecture.id));
    if (mapFilter === 'wishlist') return wishlistIds;
    return undefined;
  }, [mapFilter, visitedIds, wishlistIds]);
  const prefecturesForPicker = useMemo(() => {
    const keyword = prefectureSearch.trim().toLowerCase();
    if (!keyword) return PREFECTURES;
    return PREFECTURES.filter((prefecture) => prefecture.name.toLowerCase().includes(keyword) || prefecture.region.toLowerCase().includes(keyword));
  }, [prefectureSearch]);
  const unreadNotificationCount = notifications.filter((notification) => !notification.is_read).length;
  const profileById = useMemo(() => new Map(profiles.map((item) => [item.user_id, item])), [profiles]);

  function handlePrefectureSelect(prefecture: Prefecture) {
    setSelected(prefecture);
    setIsMapSheetOpen(true);
  }

  function openEditorForSelected() {
    if (!selectedPrefecture) {
      openPrefecturePicker();
      return;
    }
    resetMobileZoom();
    setIsMapSheetOpen(false);
    setIsPrefecturePickerOpen(false);
    setEditingVisit(null);
    setForm(defaultForm);
    setFiles(null);
    setIsEditorOpen(true);
  }

  function openEditorForPrefecture(prefecture: Prefecture) {
    resetMobileZoom();
    setSelected(prefecture);
    setIsMapSheetOpen(false);
    setIsPrefecturePickerOpen(false);
    setEditingVisit(null);
    setForm(defaultForm);
    setFiles(null);
    setIsEditorOpen(true);
  }

  function goToMobileView(view: 'home' | 'map' | 'plan' | 'timeline') {
    if (view !== 'map') setIsMapSheetOpen(false);
    setIsPrefecturePickerOpen(false);
    setActiveMobileView(view);
  }

  function openPrefecturePicker() {
    resetMobileZoom();
    setIsMapSheetOpen(false);
    setPrefectureSearch('');
    setIsPrefecturePickerOpen(true);
  }

  function choosePrefectureForNewVisit(prefecture: Prefecture) {
    openEditorForPrefecture(prefecture);
  }

  function goToMapView() {
    setActiveMobileView('map');
    setIsMapSheetOpen(false);
  }

  function viewSelectedMemories() {
    setActiveMobileView('timeline');
    setIsMapSheetOpen(false);
  }

  function planForSelectedPrefecture() {
    setActiveMobileView('plan');
    setIsMapSheetOpen(false);
  }

  function openVisitFromMapPhoto(visit: PrefectureVisit) {
    const prefecture = PREFECTURES.find((item) => item.id === visit.prefecture_id);
    if (prefecture) setSelected(prefecture);
    setIsMapSheetOpen(false);
    setActiveMobileView('timeline');
  }

  function previewPrefecture(_prefecture: Prefecture) {
    setHoveredPrefecture(_prefecture);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!couple || !selectedPrefecture) return;
    setSaving(true);
    setMessage('');

    const payload = {
      couple_id: couple.id,
      prefecture_id: selectedPrefecture.id,
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
      const uploadedCount = await uploadPhotos(visit.id, files);
      if (uploadedCount > 0) {
        await createNotifications({
          type: 'photo_added',
          title: '新しい写真が追加されました',
          message: `${(profile?.nickname ?? 'メンバー')}さんが${selectedPrefecture.name}の写真を追加しました`,
          related_prefecture: selectedPrefecture.id,
          related_visit_id: visit.id,
        });
      }
    }

    if (form.comment.trim() && session) {
      const { error: commentError } = await supabase.from('visit_comments').insert({
        couple_id: couple.id,
        visit_id: visit.id,
        user_id: session.user.id,
        comment_type: 'comment',
        body: form.comment.trim(),
      });
      if (commentError) {
        setMessage(commentError.message);
      }
    }

    if (!editingVisit) {
      await createNotifications({
        type: 'visit_created',
        title: `${(profile?.nickname ?? 'メンバー')}さんが新しい思い出を追加しました`,
        message: `${selectedPrefecture.name}・${form.place_name}`,
        related_prefecture: selectedPrefecture.id,
        related_visit_id: visit.id,
      });
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
      comment: '',
      nights: visit.nights,
      tags: visit.tags.join(', '),
    });
    setFiles(null);
    setIsEditorOpen(true);
  }

  async function uploadPhotos(visitId: string, uploadFiles: FileList) {
    if (!couple) return 0;
    let uploadedCount = 0;
    for (const file of Array.from(uploadFiles)) {
      const photoId = crypto.randomUUID();
      const compressed = await resizeImage(file, 1600, 0.78, 800 * 1024);
      const thumbnail = await resizeThumbnail(file);
      const originalPath = `${couple.id}/${visitId}/originals/${photoId}.webp`;
      const thumbnailPath = `${couple.id}/${visitId}/thumbnails/${photoId}.webp`;
      const { error: uploadError } = await supabase.storage.from('travel-photos').upload(originalPath, compressed, {
        contentType: 'image/webp',
      });
      if (uploadError) {
        setMessage(uploadError.message);
        continue;
      }
      const { error: thumbnailUploadError } = await supabase.storage.from('travel-photos').upload(thumbnailPath, thumbnail, {
        contentType: 'image/webp',
      });
      if (thumbnailUploadError) {
        setMessage(thumbnailUploadError.message);
      }
      const { error: photoError } = await supabase.from('photos').insert({
        couple_id: couple.id,
        visit_id: visitId,
        storage_path: originalPath,
        original_url: originalPath,
        thumbnail_url: thumbnailUploadError ? null : thumbnailPath,
        original_storage_path: originalPath,
        thumbnail_storage_path: thumbnailUploadError ? null : thumbnailPath,
      });
      if (photoError) {
        setMessage(photoError.message);
        continue;
      }
      uploadedCount += 1;
    }
    return uploadedCount;
  }

  async function createPhotoSignedUrlMap(pathsOrUrls: Array<string | null | undefined>) {
    const urlMap = new Map<string, string | null>();
    const storagePaths = [
      ...new Set(
        pathsOrUrls
          .filter((pathOrUrl): pathOrUrl is string => Boolean(pathOrUrl))
          .filter((pathOrUrl) => {
            if (/^https?:\/\//.test(pathOrUrl)) {
              urlMap.set(pathOrUrl, pathOrUrl);
              return false;
            }
            const cachedUrl = photoSignedUrlCache.get(pathOrUrl);
            if (cachedUrl && cachedUrl.expiresAt > Date.now()) {
              urlMap.set(pathOrUrl, cachedUrl.url);
              return false;
            }
            return true;
          }),
      ),
    ];

    for (let index = 0; index < storagePaths.length; index += 100) {
      const chunk = storagePaths.slice(index, index + 100);
      const { data } = await supabase.storage.from('travel-photos').createSignedUrls(chunk, 60 * 60);
      data?.forEach((item) => {
        if (!item.path || !item.signedUrl) return;
        photoSignedUrlCache.set(item.path, {
          url: item.signedUrl,
          expiresAt: Date.now() + SIGNED_PHOTO_URL_TTL_MS,
        });
        urlMap.set(item.path, item.signedUrl);
      });
    }

    storagePaths.forEach((path) => {
      if (!urlMap.has(path)) urlMap.set(path, null);
    });
    return urlMap;
  }

  async function attachSignedPhotoUrls(nextVisits: PrefectureVisit[]) {
    const displayPaths = nextVisits.flatMap((visit) =>
      (visit.photos ?? []).map((photo) => photo.thumbnail_storage_path ?? photo.thumbnail_url ?? photo.original_storage_path ?? photo.storage_path ?? photo.original_url),
    );
    const signedUrlMap = await createPhotoSignedUrlMap(displayPaths);
    return nextVisits.map((visit) => ({
      ...visit,
      photos: (visit.photos ?? []).map((photo) => {
        const originalPath = photo.original_storage_path ?? photo.storage_path ?? photo.original_url;
        const thumbnailPath = photo.thumbnail_storage_path ?? photo.thumbnail_url;
        const displayPath = thumbnailPath ?? originalPath;
        const displayUrl = displayPath ? signedUrlMap.get(displayPath) ?? null : null;
        return {
          ...photo,
          public_url: displayUrl,
          thumbnail_url: displayUrl,
          original_url: /^https?:\/\//.test(photo.original_url ?? '') ? photo.original_url : null,
        };
      }),
    }));
  }

  async function loadMapCollagePhotos(coupleId: string, options: { animated?: boolean; excludePrevious?: boolean } = {}) {
    if (options.animated) {
      setIsMapCollageRefreshing(true);
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }

    const excludedIds = options.excludePrevious ? mapCollagePhotoIdsRef.current : [];
    let { data, error } = await supabase.rpc('get_random_map_collage_photos', {
      target_couple_id: coupleId,
      max_count: 3,
      exclude_photo_ids: excludedIds,
    });

    if (!error && (!data || data.length === 0) && excludedIds.length > 0) {
      const retry = await supabase.rpc('get_random_map_collage_photos', {
        target_couple_id: coupleId,
        max_count: 3,
        exclude_photo_ids: [],
      });
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      setMessage(error.message);
      setMapCollageVisits([]);
      setIsMapCollageRefreshing(false);
      return;
    }

    const rows = (data as MapCollagePhotoRow[] | null) ?? [];
    const displayPaths = rows.map((photo) => photo.thumbnail_storage_path ?? photo.thumbnail_url ?? photo.original_storage_path ?? photo.storage_path ?? photo.original_url);
    const signedUrlMap = await createPhotoSignedUrlMap(displayPaths);
    const collageVisits = rows
      .map((photo) => {
        const displayPath = photo.thumbnail_storage_path ?? photo.thumbnail_url ?? photo.original_storage_path ?? photo.storage_path ?? photo.original_url;
        const displayUrl = displayPath ? signedUrlMap.get(displayPath) ?? null : null;
        return {
          id: photo.visit_id,
          couple_id: photo.couple_id,
          prefecture_id: photo.prefecture_id,
          visited_on: photo.visited_on,
          place_name: photo.place_name,
          memo: photo.memo,
          nights: photo.nights,
          tags: photo.tags ?? [],
          created_at: photo.visit_created_at,
          photos: [
            {
              id: photo.photo_id,
              visit_id: photo.visit_id,
              storage_path: photo.storage_path,
              caption: photo.caption,
              public_url: displayUrl,
              thumbnail_url: displayUrl,
              original_url: /^https?:\/\//.test(photo.original_url ?? '') ? photo.original_url : null,
              original_storage_path: photo.original_storage_path,
              thumbnail_storage_path: photo.thumbnail_storage_path,
            },
          ],
        } satisfies PrefectureVisit;
      })
      .filter((visit) => visit.photos?.[0]?.public_url);

    mapCollagePhotoIdsRef.current = collageVisits.flatMap((visit) => visit.photos?.map((photo) => photo.id) ?? []);
    setMapCollageVisits(collageVisits);
    setIsMapCollageRefreshing(false);
  }

  async function deleteVisit(visitId: string) {
    if (!confirm('この旅行記録を削除しますか？')) return;
    const { error } = await supabase.from('prefecture_visits').delete().eq('id', visitId);
    if (error) setMessage(error.message);
    await loadCoupleAndVisits();
  }

  async function deletePhoto(photo: VisitPhoto) {
    if (!confirm('この写真を削除しますか？')) return;
    const paths = [
      photo.storage_path,
      photo.original_storage_path,
      photo.thumbnail_storage_path,
      photo.original_url && !/^https?:\/\//.test(photo.original_url) ? photo.original_url : null,
      photo.thumbnail_url && !/^https?:\/\//.test(photo.thumbnail_url) ? photo.thumbnail_url : null,
    ].filter(Boolean) as string[];
    await supabase.storage.from('travel-photos').remove([...new Set(paths)]);
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
    if (!couple || !selectedPrefecture) return;
    const { data: wishlist, error } = await supabase
      .from('wishlist')
      .insert({
        couple_id: couple.id,
        prefecture_id: selectedPrefecture.id,
        title: wishlistForm.title,
        food: wishlistForm.food || null,
        sightseeing: wishlistForm.sightseeing || null,
        memo: wishlistForm.memo || null,
      })
      .select()
      .single();
    if (error) {
      setMessage(error.message);
      return;
    }
    await createNotifications({
      type: 'wishlist_created',
      title: '行きたい場所が追加されました',
      message: `${(profile?.nickname ?? 'メンバー')}さんが${selectedPrefecture.name}に「${wishlistForm.title}」を追加しました`,
      related_prefecture: selectedPrefecture.id,
      related_wishlist_id: (wishlist as WishlistItem).id,
    });
    setWishlistForm(defaultWishlistForm);
    await loadCoupleAndVisits();
  }

  async function deleteWishlistItem(itemId: string) {
    const { error } = await supabase.from('wishlist').delete().eq('id', itemId);
    if (error) setMessage(error.message);
    await loadCoupleAndVisits();
  }

  async function saveComment(visit: PrefectureVisit, body: string) {
    if (!couple || !session) return;
    const payload = {
      couple_id: couple.id,
      visit_id: visit.id,
      user_id: session.user.id,
      comment_type: 'comment',
      body,
    };
    const { error } = await supabase.from('visit_comments').insert(payload);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadCoupleAndVisits();
  }

  async function createNotifications(input: {
    type: AppNotification['type'];
    title: string;
    message: string;
    related_prefecture?: number;
    related_visit_id?: string;
    related_wishlist_id?: string;
  }) {
    if (!couple || !session) return;
    const recipients = memberIds.filter((userId) => userId !== session.user.id);
    if (recipients.length === 0) return;
    const payload = recipients.map((recipientUserId) => ({
      couple_id: couple.id,
      recipient_user_id: recipientUserId,
      actor_user_id: session.user.id,
      type: input.type,
      title: input.title,
      message: input.message,
      related_prefecture: input.related_prefecture ?? null,
      related_visit_id: input.related_visit_id ?? null,
      related_wishlist_id: input.related_wishlist_id ?? null,
    }));
    const { error } = await supabase.from('notifications').insert(payload);
    if (error) setMessage(error.message);
  }

  async function deleteComment(commentId: string) {
    const { error } = await supabase.from('visit_comments').delete().eq('id', commentId);
    if (error) setMessage(error.message);
    await loadCoupleAndVisits();
  }

  async function markNotificationRead(notificationId: string) {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setNotifications((current) => current.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item)));
  }

  async function markAllNotificationsRead() {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('recipient_user_id', session!.user.id).eq('is_read', false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
  }

  async function openNotification(notification: AppNotification) {
    await markNotificationRead(notification.id);
    const prefecture = notification.related_prefecture
      ? PREFECTURES.find((item) => item.id === notification.related_prefecture)
      : null;
    if (prefecture) setSelected(prefecture);
    setActiveMobileView(notification.type === 'wishlist_created' ? 'plan' : 'timeline');
    setIsNotificationOpen(false);
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
  if (profile.account_status && profile.account_status !== 'active') {
    return (
      <main className="auth-shell">
        <AccountManagement
          profile={profile}
          inAppNotificationsEnabled={userSettings?.in_app_notifications_enabled ?? true}
          pushNotificationsEnabled={userSettings?.push_notifications_enabled ?? false}
          onSettingsChanged={loadCoupleAndVisits}
          onChanged={loadCoupleAndVisits}
        />
      </main>
    );
  }
  if (!couple) return <CoupleSetup onReady={loadCoupleAndVisits} />;

  return (
    <main className="page-shell">
      <header className={"app-header " + (activeMobileView === 'home' ? 'is-home' : '')}>
        <div>
          <h1>TabiCanvas</h1>
          <p>
            {(profile?.nickname ?? 'メンバー')}でログイン中 / 招待コード: <strong>{couple.invite_code}</strong>
          </p>
        </div>
        <div className="header-actions">
          <button className="icon-button" aria-label="設定" onClick={() => setIsAccountManagementOpen(true)}>
            <Settings size={20} />
          </button>
          <button className="icon-button notification-button" aria-label="通知" onClick={() => setIsNotificationOpen((value) => !value)}>
            <Bell size={20} />
            {unreadNotificationCount > 0 && <span className="notification-badge">{unreadNotificationCount}</span>}
          </button>
          <button className="icon-button" aria-label="ログアウト" onClick={() => supabase.auth.signOut()}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {isNotificationOpen && (
        <section className="notification-panel" aria-label="通知一覧">
          <div className="notification-panel-head">
            <div>
              <p className="eyebrow">Notifications</p>
              <h2>通知</h2>
            </div>
            <button className="text-button inline" onClick={markAllNotificationsRead} disabled={unreadNotificationCount === 0}>
              <CheckCheck size={15} />
              すべて既読
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="empty compact">まだ通知はありません。</p>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => {
                const actorName = profileById.get(notification.actor_user_id ?? '')?.nickname;
                return (
                  <button
                    key={notification.id}
                    className={`notification-item ${notification.is_read ? '' : 'is-unread'}`}
                    onClick={() => openNotification(notification)}
                  >
                    <span className="notification-dot" />
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                      <small>
                        {actorName ? `${actorName}さん / ` : ''}
                        {new Date(notification.created_at).toLocaleString('ja-JP', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {isAccountManagementOpen && (
        <div className="editor-backdrop" role="dialog" aria-modal="true" aria-label="アカウント管理">
          <aside className="panel editor-panel account-management-dialog">
            <div className="editor-panel-head">
              <div className="section-title danger-title">
                <Settings size={18} />
                <h2>アカウント管理</h2>
              </div>
              <button className="icon-button small" aria-label="閉じる" onClick={() => setIsAccountManagementOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <AccountManagement
              profile={profile}
              inviteCode={couple.invite_code}
              inAppNotificationsEnabled={userSettings?.in_app_notifications_enabled ?? true}
              pushNotificationsEnabled={userSettings?.push_notifications_enabled ?? false}
              onSettingsChanged={loadCoupleAndVisits}
              onChanged={loadCoupleAndVisits}
            />
          </aside>
        </div>
      )}

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
            <button onClick={() => setIsAccountManagementOpen(true)}>
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
              <h2>こんにちは、{(profile?.nickname ?? 'メンバー')}さん</h2>
              <p>地図をなぞるように、旅の記録を振り返りましょう。</p>
            </div>
            <button className="icon-button notification-button" aria-label="通知" onClick={() => setIsNotificationOpen((value) => !value)}>
              <Bell size={20} />
              {unreadNotificationCount > 0 && <span className="notification-badge">{unreadNotificationCount}</span>}
            </button>
            <button className="primary-button" onClick={openPrefecturePicker}>
              <Plus size={18} />
              思い出を追加
            </button>
          </div>

          <StatsPanel visits={visits} />

          <section className="desktop-map-card" onMouseLeave={() => setHoveredPrefecture(null)}>
            <div className="desktop-map-copy">
              <p className="eyebrow">Japan map</p>
              <h2>47都道府県マップ</h2>
              <p>県にカーソルを合わせると右のアルバムが切り替わります。クリックすると記録を追加できます。</p>
            </div>
            <JapanMap
              selectedId={selectedPrefecture?.id ?? null}
              visitCounts={visitCounts}
              onPreview={previewPrefecture}
              onSelect={openEditorForPrefecture}
            />
            <div className="desktop-hover-card">
              <div>
                <strong>{desktopPreviewPrefecture?.name ?? '都道府県を選んでください'}</strong>
                <span>{desktopPreviewPrefecture ? `${desktopPreviewVisits.length}件の思い出` : '地図にカーソルを合わせると写真が出ます'}</span>
              </div>
              <div className="desktop-hover-photos">
                {selectedPreviewPhotos.length ? (
                  selectedPreviewPhotos.map((photo) => (
                    <img
                      key={photo.id}
                      src={getPhotoDisplayUrl(photo)}
                      alt={`${desktopPreviewPrefecture?.name ?? '旅'}の写真`}
                      loading="lazy"
                      decoding="async"
                    />
                  ))
                ) : (
                  <p>{desktopPreviewPrefecture ? '写真はまだありません' : '県を選ぶとアルバムを確認できます'}</p>
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
                  const photoUrl = getPhotoDisplayUrl(photo);
                  return (
                    <article key={visit.id} className="desktop-polaroid" onClick={() => editVisit(visit)}>
                      {photoUrl ? <img src={photoUrl} alt={`${visit.place_name}の写真`} loading="lazy" decoding="async" /> : <div className="desktop-photo-placeholder" />}
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
            selected={selectedPrefecture}
            items={selectedPrefecture ? selectedWishlistItems : nextWishlistItems}
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
        <div className="mobile-home-page">
        <section className="panel mobile-dashboard-card mobile-memory-album">
          <div className="section-title">
            <Clock size={18} />
            <h2>最近の思い出</h2>
          </div>
          {recentVisits.length ? (
            <div className="mobile-dashboard-list">
              {recentVisits.slice(0, 3).map((visit, index) => {
                const pref = PREFECTURES.find((item) => item.id === visit.prefecture_id);
                const photo = visit.photos?.[0];
                const photoCount = visit.photos?.length ?? 0;
                const photoUrl = getPhotoDisplayUrl(photo);
                return (
                  <button key={visit.id} className={`mobile-memory-card ${index === 0 ? 'is-featured' : ''}`} onClick={() => editVisit(visit)}>
                    <figure>
                      {photoUrl ? (
                        <>
                          <img src={photoUrl} alt={`${visit.place_name}の写真`} loading="lazy" decoding="async" />
                          {photoCount > 1 && <span className="photo-more-badge">+{photoCount - 1}</span>}
                        </>
                      ) : (
                        <div className="mobile-memory-placeholder">
                          <Camera size={20} />
                        </div>
                      )}
                    </figure>
                    <div>
                      <span>{visit.visited_on}</span>
                      <strong>{pref?.name}・{visit.place_name}</strong>
                      {visit.memo && <small>{visit.memo}</small>}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="empty compact">まだ思い出がありません。</p>
          )}
        </section>

        <section className="mobile-dashboard-actions">
          <button className="secondary-button" onClick={goToMapView}>
            <MapIcon size={18} />
            地図で見る
          </button>
          <button className="primary-button" onClick={openPrefecturePicker}>
            <Plus size={18} />
            思い出を追加
          </button>
        </section>

        <section className="mobile-summary-card panel">
          <div>
            <p className="eyebrow">YOUR JOURNEY</p>
            <h2>旅の進み具合</h2>
          </div>
          <div className="mobile-summary-grid">
            <div>
              <Trophy size={18} />
              <span>制覇率</span>
              <strong>{visitedIds.size}/47県</strong>
              <small>{completionRate}% 達成</small>
            </div>
            <div>
              <MapIcon size={18} />
              <span>旅行回数</span>
              <strong>{visits.length}回</strong>
            </div>
            <div>
              <Camera size={18} />
              <span>一番行った県</span>
              <strong>{topPrefecture}</strong>
            </div>
          </div>
          <div className="progress-track">
            <div style={{ width: `${completionRate}%` }} />
          </div>
        </section>

        <section className="panel mobile-dashboard-card">
          <div className="section-title">
            <ListTodo size={18} />
            <h2>次に行きたい場所</h2>
          </div>
          {nextWishlistItems.length ? (
            <div className="mobile-dashboard-list">
              {nextWishlistItems.map((item) => {
                const pref = PREFECTURES.find((prefecture) => prefecture.id === item.prefecture_id);
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (pref) setSelected(pref);
                      setActiveMobileView('plan');
                    }}
                  >
                    <span>{pref?.name}</span>
                    <strong>{item.title}</strong>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="empty compact">行きたい場所はまだありません。</p>
          )}
        </section>

        <section className="panel mobile-dashboard-card">
          <div className="section-title">
            <Trophy size={18} />
            <h2>地方別進捗</h2>
          </div>
          <div className="mobile-region-summary">
            {REGIONS.map((region) => {
              const regionPrefs = PREFECTURES.filter((prefecture) => prefecture.region === region);
              const done = regionPrefs.filter((prefecture) => visitedIds.has(prefecture.id)).length;
              return (
                <div key={region}>
                  <span>{region}</span>
                  <div className="mini-track">
                    <div style={{ width: `${(done / regionPrefs.length) * 100}%` }} />
                  </div>
                  <small>{done}/{regionPrefs.length}</small>
                </div>
              );
            })}
          </div>
        </section>
        </div>
      </section>

      <section className={`mobile-section mobile-map-section ${activeMobileView === 'map' ? 'is-active' : ''}`}>
        <StatsPanel visits={visits} />
        <BadgePanel visits={visits} />

        <section className="panel map-control-panel">
          <div className="map-filter-row" aria-label="地図フィルター">
            {[
              ['all', 'すべて'],
              ['visited', '行った県'],
              ['unvisited', '未制覇'],
              ['wishlist', '行きたい県'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={mapFilter === value ? 'is-active' : ''}
                onClick={() => setMapFilter(value as 'all' | 'visited' | 'unvisited' | 'wishlist')}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="map-detail-legend" aria-label="地図の凡例">
            <span><i className="legend-swatch visit-0" />未訪問</span>
            <span><i className="legend-swatch visit-1" />訪問済み</span>
            <span><i className="legend-swatch visit-4" />複数回訪問</span>
            <span><i className="legend-swatch wishlist" />行きたい県</span>
          </div>
          {!selectedPrefecture && (
            <p className="empty compact">
              地図から都道府県を選んでください。都道府県を選ぶと、思い出や計画を確認できます。
            </p>
          )}
        </section>

        <section className="map-layout">
          <aside className="prefecture-list panel" aria-label="都道府県一覧">
            <div className="section-title">
              <MapIcon size={18} />
              <h2>都道府県一覧</h2>
            </div>
            <div className="prefecture-list-grid">
              {PREFECTURES.map((prefecture) => {
                const count = visitCounts.get(prefecture.id) ?? 0;
                const isSelected = selectedPrefecture?.id === prefecture.id;
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
          <div className="map-photo-stage">
            <JapanMap
              selectedId={selectedPrefecture?.id ?? null}
              visitCounts={visitCounts}
              highlightedIds={filteredPrefectureIds}
              wishlistIds={wishlistIds}
              onSelect={handlePrefectureSelect}
            />
            <MapPhotoCollage visits={mapCollageVisits} isRefreshing={isMapCollageRefreshing} onOpenVisit={openVisitFromMapPhoto} />
          </div>
        </section>
      </section>

      {activeMobileView === 'map' && isMapSheetOpen && selectedPrefecture && (
        <section className="map-bottom-sheet" aria-label={`${selected.name}の概要`}>
          <div className="sheet-handle" />
          <div className="map-sheet-head">
            <div>
              <p className="eyebrow">Selected prefecture</p>
              <h2>{selected.name}</h2>
            </div>
            <button className="icon-button small" aria-label="閉じる" onClick={() => setIsMapSheetOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="map-sheet-stats">
            <span>訪問 {visitCounts.get(selected.id) ?? 0}回</span>
            <span>写真 {selectedPhotoCount}枚</span>
          </div>
          {selectedSheetPhotos.length > 0 && (
            <div className="map-sheet-photo-strip" aria-label={`${selected.name}の写真`}>
              {selectedSheetPhotos.map(({ photo, visit }) => (
                <button key={photo.id} type="button" onClick={() => openVisitFromMapPhoto(visit)}>
                  <img src={getPhotoDisplayUrl(photo)} alt={`${visit.place_name}の写真`} loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
          <p className="empty compact">
            {latestSelectedVisit
              ? `最新の思い出: ${latestSelectedVisit.place_name} (${latestSelectedVisit.visited_on})`
              : 'この県の思い出はまだありません。'}
          </p>
          <div className="map-sheet-actions">
            <button className="secondary-button" onClick={viewSelectedMemories}>
              思い出を見る
            </button>
            <button className="primary-button" onClick={openEditorForSelected}>
              思い出を追加
            </button>
            <button className="secondary-button" onClick={planForSelectedPrefecture}>
              行きたい場所に追加
            </button>
          </div>
        </section>
      )}

      <section className={`mobile-section ${activeMobileView === 'plan' ? 'is-active' : ''}`}>
        <section className="detail-grid">
          <WishlistPanel
            selected={selectedPrefecture}
            items={selectedWishlistItems}
            form={wishlistForm}
            onFormChange={setWishlistForm}
            onSubmit={handleWishlistSubmit}
            onDelete={deleteWishlistItem}
          />
        </section>
      </section>

      <section className={`mobile-section ${activeMobileView === 'timeline' ? 'is-active' : ''}`}>
        <TimelinePanel
          visits={visits}
          selected={selectedPrefecture}
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
        <button className="mobile-add-button" aria-label="記録を追加" onClick={openPrefecturePicker}>
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

      {isPrefecturePickerOpen && (
        <div className="picker-backdrop" role="dialog" aria-modal="true" aria-label="都道府県を選択">
          <section className="panel prefecture-picker">
            <div className="picker-head">
              <div>
                <p className="eyebrow">New memory</p>
                <h2>どの都道府県の思い出を追加しますか？</h2>
              </div>
              <button className="icon-button small" aria-label="閉じる" onClick={() => setIsPrefecturePickerOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <label className="picker-search">
              <Search size={18} />
              <input
                value={prefectureSearch}
                onChange={(event) => setPrefectureSearch(event.target.value)}
                placeholder="都道府県を検索"
                autoFocus
              />
            </label>

            {selectedPrefecture ? (
            <div className="picker-suggestion">
              <span>選択中の県</span>
              <button onClick={() => choosePrefectureForNewVisit(selectedPrefecture)}>
                {selectedPrefecture.name}に追加
                <small>
                  {visitCounts.get(selectedPrefecture.id) ?? 0}回訪問 / {wishlistIds.has(selectedPrefecture.id) ? '行きたい県' : visitedIds.has(selectedPrefecture.id) ? '訪問済み' : '未訪問'}
                </small>
              </button>
            </div>
            ) : (
              <p className="empty compact">
                地図から都道府県を選んでください。都道府県を選ぶと、思い出や計画を確認できます。
              </p>
            )}

            <div className="picker-region-list">
              {REGIONS.map((region) => {
                const regionPrefs = prefecturesForPicker.filter((prefecture) => prefecture.region === region);
                if (regionPrefs.length === 0) return null;
                return (
                  <section key={region}>
                    <h3>{region}</h3>
                    <div className="picker-pref-grid">
                      {regionPrefs.map((prefecture) => {
                        const count = visitCounts.get(prefecture.id) ?? 0;
                        const isVisited = count > 0;
                        const isWishlist = wishlistIds.has(prefecture.id);
                        return (
                          <button
                            key={prefecture.id}
                            className={`${selectedPrefecture?.id === prefecture.id ? 'is-selected' : ''} ${isVisited ? 'is-visited' : ''}`}
                            onClick={() => choosePrefectureForNewVisit(prefecture)}
                          >
                            <span>{prefecture.name}</span>
                            <small>{isVisited ? `${count}回訪問` : '未訪問'}{isWishlist ? ' / 行きたい' : ''}</small>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        </div>
      )}

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
                コメント
                <textarea
                  value={form.comment}
                  onChange={(event) => setForm({ ...form, comment: event.target.value })}
                  placeholder="この旅で話したこと、感じたことなど"
                  rows={3}
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
