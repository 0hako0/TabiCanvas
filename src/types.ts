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
};

export type VisitPhoto = {
  id: string;
  visit_id: string;
  storage_path: string;
  public_url: string | null;
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
  created_at: string;
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
  title: string;
  food: string;
  sightseeing: string;
  memo: string;
};
