export type Prefecture = {
  id: number;
  name: string;
  region: string;
  x: number;
  y: number;
};

export type Couple = {
  id: string;
  name: string;
  invite_code: string;
};

export type Profile = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  account_status?: 'active' | 'deactivated' | 'scheduled_for_deletion';
  deletion_scheduled_at?: string | null;
  deletion_due_at?: string | null;
  deactivated_at?: string | null;
};

export type VisitPhoto = {
  id: string;
  visit_id: string;
  storage_path: string;
  public_url: string | null;
  thumbnail_url?: string | null;
  original_url?: string | null;
  thumbnail_storage_path?: string | null;
  original_storage_path?: string | null;
  caption: string | null;
};

export type VisitComment = {
  id: string;
  couple_id: string;
  visit_id: string;
  user_id: string | null;
  comment_type: 'comment' | 'reaction' | 'ai_note';
  body: string;
  created_at: string;
};

export type PrefectureVisit = {
  id: string;
  couple_id: string;
  prefecture_id: number;
  visited_on: string;
  place_name: string;
  memo: string | null;
  nights: number;
  tags: string[];
  created_at: string;
  photos?: VisitPhoto[];
  visit_comments?: VisitComment[];
};

export type WishlistItem = {
  id: string;
  couple_id: string;
  prefecture_id: number;
  title: string;
  food: string | null;
  sightseeing: string | null;
  memo: string | null;
  website_url: string | null;
  google_maps_url: string | null;
  created_at: string;
  updated_at?: string;
};

export type AppNotification = {
  id: string;
  couple_id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  type: 'visit_created' | 'photo_added' | 'wishlist_created' | 'account_status';
  title: string;
  message: string | null;
  related_prefecture: number | null;
  related_visit_id: string | null;
  related_wishlist_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type UserSettings = {
  user_id: string;
  in_app_notifications_enabled: boolean;
  push_notifications_enabled: boolean;
  created_at?: string;
  updated_at?: string;
};

export type VisitFormState = {
  visited_on: string;
  place_name: string;
  memo: string;
  comment: string;
  nights: number;
  tags: string;
};

export type WishlistFormState = {
  prefecture_id: number | '';
  title: string;
  food: string;
  sightseeing: string;
  memo: string;
  website_url: string;
  google_maps_url: string;
};
