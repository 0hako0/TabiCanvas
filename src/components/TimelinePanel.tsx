import { FormEvent, useEffect, useState } from 'react';
import { Clock, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { PREFECTURES } from '../data/prefectures';
import type { Prefecture, PrefectureVisit, Profile } from '../types';

type Props = {
  visits: PrefectureVisit[];
  selected: Prefecture | null;
  currentUserId: string;
  profiles: Profile[];
  onEditVisit: (visit: PrefectureVisit) => void;
  onDeleteVisit: (visitId: string) => void;
  onSaveComment: (visit: PrefectureVisit, body: string) => void;
  onDeleteComment: (commentId: string) => void;
};

export function TimelinePanel({
  visits,
  selected,
  currentUserId,
  profiles,
  onEditVisit,
  onDeleteVisit,
  onSaveComment,
  onDeleteComment,
}: Props) {
  const [scope, setScope] = useState<'selected' | 'all'>('all');

  useEffect(() => {
    setScope(selected ? 'selected' : 'all');
  }, [selected?.id]);

  const scopedVisits = scope === 'selected' && selected ? visits.filter((visit) => visit.prefecture_id === selected.id) : visits;
  const recentVisits = scopedVisits.slice(0, 12);

  return (
    <section className="timeline">
      <div className="timeline-head">
        <div className="section-title">
          <Clock size={18} />
          <h2>{scope === 'selected' && selected ? `${selected.name}の思い出` : 'すべての思い出'}</h2>
        </div>
        <div className="segmented-control" aria-label="タイムライン表示切り替え">
          <button className={scope === 'selected' ? 'is-active' : ''} onClick={() => setScope('selected')} disabled={!selected}>
            選択中の県
          </button>
          <button className={scope === 'all' ? 'is-active' : ''} onClick={() => setScope('all')}>
            すべて
          </button>
        </div>
      </div>
      {recentVisits.length === 0 ? (
        <p className="empty">
          {scope === 'selected' && selected
            ? `${selected.name}の旅行記録はまだありません。`
            : 'まだ旅行記録がありません。地図から都道府県を選んで、最初の思い出を残しましょう。'}
        </p>
      ) : (
        recentVisits.map((visit) => (
          <TimelineCard
            key={visit.id}
            visit={visit}
            currentUserId={currentUserId}
            profiles={profiles}
            onEditVisit={onEditVisit}
            onDeleteVisit={onDeleteVisit}
            onSaveComment={onSaveComment}
            onDeleteComment={onDeleteComment}
          />
        ))
      )}
    </section>
  );
}

type CardProps = {
  visit: PrefectureVisit;
  currentUserId: string;
  profiles: Profile[];
  onEditVisit: (visit: PrefectureVisit) => void;
  onDeleteVisit: (visitId: string) => void;
  onSaveComment: (visit: PrefectureVisit, body: string) => void;
  onDeleteComment: (commentId: string) => void;
};

function TimelineCard({
  visit,
  currentUserId,
  profiles,
  onEditVisit,
  onDeleteVisit,
  onSaveComment,
  onDeleteComment,
}: CardProps) {
  const [commentBody, setCommentBody] = useState('');
  const prefectureName = PREFECTURES.find((prefecture) => prefecture.id === visit.prefecture_id)?.name;
  const profileById = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const comments = [...(visit.visit_comments ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  function handleCommentSubmit(event: FormEvent) {
    event.preventDefault();
    if (!commentBody.trim()) return;
    onSaveComment(visit, commentBody.trim());
    setCommentBody('');
  }

  return (
    <article className="visit-card">
      <div className="visit-card-head">
        <div>
          <time>{visit.visited_on}</time>
          <h3>{prefectureName}・{visit.place_name}</h3>
        </div>
        <div className="card-actions">
          <button className="icon-button small" aria-label="旅行記録を編集" onClick={() => onEditVisit(visit)}>
            <Pencil size={16} />
          </button>
          <button className="icon-button small" aria-label="旅行記録を削除" onClick={() => onDeleteVisit(visit.id)}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {visit.photos?.length ? (
        <div className="photo-grid compact">
          {visit.photos.slice(0, 3).map((photo) => (
            <figure key={photo.id}>
              <img src={photo.public_url ?? ''} alt={`${visit.place_name}の写真`} />
            </figure>
          ))}
        </div>
      ) : null}
      {visit.memo && <p>{visit.memo}</p>}
      <div className="tag-row">
        {visit.tags.map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
        {visit.nights > 0 && <span>{visit.nights}泊</span>}
      </div>

      <div className="comment-box">
        <div className="comment-title">
          <MessageCircle size={16} />
          <strong>コメント</strong>
        </div>
        {comments.map((comment) => {
          const isMine = comment.user_id === currentUserId;
          return (
            <div key={comment.id} className={`comment-bubble ${isMine ? 'mine' : 'partner'}`}>
              <strong>{profileById.get(comment.user_id ?? '')?.nickname ?? (isMine ? '自分' : 'メンバー')}</strong>
              <p>{comment.body}</p>
              <small>
                {new Date(comment.created_at).toLocaleString('ja-JP', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </small>
              {isMine && (
                <button
                  type="button"
                  className="text-button inline"
                  onClick={() => {
                    if (confirm('このコメントを削除しますか？')) onDeleteComment(comment.id);
                  }}
                >
                  削除
                </button>
              )}
            </div>
          );
        })}
        <form className="comment-form" onSubmit={handleCommentSubmit}>
          <textarea
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            placeholder="コメントを書く"
            rows={2}
          />
          <button className="secondary-button">送信</button>
        </form>
      </div>
    </article>
  );
}
