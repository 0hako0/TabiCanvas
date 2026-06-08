import { FormEvent } from 'react';
import { Edit3, ExternalLink, ListPlus, Navigation, Trash2 } from 'lucide-react';
import type { Prefecture, WishlistFormState, WishlistItem } from '../types';

type Props = {
  selected: Prefecture | null;
  items: WishlistItem[];
  form: WishlistFormState;
  onFormChange: (form: WishlistFormState) => void;
  onSubmit: (event: FormEvent) => void;
  onDelete: (itemId: string) => void;
  prefectures?: Prefecture[];
  showPrefectureSelect?: boolean;
  showItems?: boolean;
  title?: string;
  submitLabel?: string;
  showForm?: boolean;
  onEdit?: (item: WishlistItem) => void;
};

function itemSummary(item: WishlistItem) {
  return [item.food, item.sightseeing, item.memo].filter(Boolean).join(' / ');
}

export function WishlistPanel({
  selected,
  items,
  form,
  onFormChange,
  onSubmit,
  onDelete,
  prefectures = [],
  showPrefectureSelect = false,
  showItems = true,
  title,
  submitLabel = '追加',
  showForm = true,
  onEdit,
}: Props) {
  const canChoosePrefecture = showPrefectureSelect && prefectures.length > 0;
  const selectedPrefectureId = selected?.id ?? form.prefecture_id;
  const canSubmit = Boolean(selectedPrefectureId) && Boolean(form.title.trim());

  return (
    <section className="panel wishlist-panel">
      <div className="section-title">
        <ListPlus size={18} />
        <h2>{title ?? (selected ? `${selected.name}の行きたい場所` : '行きたい場所')}</h2>
      </div>
      {!selected && !canChoosePrefecture && (
        <p className="empty compact">地図から都道府県を選ぶと、行きたい場所を追加できます。</p>
      )}
      {showForm && (
        <form className="wishlist-form" onSubmit={onSubmit}>
          {canChoosePrefecture && (
            <select
              value={form.prefecture_id}
              onChange={(event) => onFormChange({ ...form, prefecture_id: event.target.value ? Number(event.target.value) : '' })}
              required
            >
              <option value="">都道府県を選択</option>
              {prefectures.map((prefecture) => (
                <option key={prefecture.id} value={prefecture.id}>
                  {prefecture.name}
                </option>
              ))}
            </select>
          )}
          <input
            value={form.title}
            onChange={(event) => onFormChange({ ...form, title: event.target.value })}
            placeholder="例: 露天風呂のある宿"
            required
            disabled={!selected && !canChoosePrefecture}
          />
          <input
            value={form.food}
            onChange={(event) => onFormChange({ ...form, food: event.target.value })}
            placeholder="食べたいもの"
            disabled={!selected && !canChoosePrefecture}
          />
          <input
            value={form.sightseeing}
            onChange={(event) => onFormChange({ ...form, sightseeing: event.target.value })}
            placeholder="行きたい観光地"
            disabled={!selected && !canChoosePrefecture}
          />
          <textarea
            value={form.memo}
            onChange={(event) => onFormChange({ ...form, memo: event.target.value })}
            placeholder="メモ"
            rows={3}
            disabled={!selected && !canChoosePrefecture}
          />
          <input
            value={form.website_url}
            onChange={(event) => onFormChange({ ...form, website_url: event.target.value })}
            placeholder="公式サイトURL"
            inputMode="url"
            disabled={!selected && !canChoosePrefecture}
          />
          <input
            value={form.google_maps_url}
            onChange={(event) => onFormChange({ ...form, google_maps_url: event.target.value })}
            placeholder="GoogleマップURL"
            inputMode="url"
            disabled={!selected && !canChoosePrefecture}
          />
          <button className="secondary-button" disabled={!canSubmit}>{submitLabel}</button>
        </form>
      )}
      {showItems && (
        <div className="wishlist-items">
          {items.length === 0 ? (
            <p className="empty compact">{selected ? 'まだ行きたい場所はありません。' : '都道府県を選ぶと、行きたい場所を追加できます。'}</p>
          ) : (
            items.map((item) => (
            <article key={item.id} className="wishlist-item">
              <div>
                {!selected && (
                  <span className="wishlist-prefecture-label">
                    {prefectures.find((prefecture) => prefecture.id === item.prefecture_id)?.name}
                  </span>
                )}
                <strong>{item.title}</strong>
                  {itemSummary(item) && <p>{itemSummary(item)}</p>}
                  {(item.website_url || item.google_maps_url) && (
                    <div className="wishlist-links">
                      {item.website_url && (
                        <a href={item.website_url} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} />
                          公式サイトを見る
                        </a>
                      )}
                      {item.google_maps_url && (
                        <a href={item.google_maps_url} target="_blank" rel="noreferrer">
                          <Navigation size={14} />
                          Googleマップで開く
                        </a>
                      )}
                    </div>
                  )}
              </div>
              <div className="wishlist-item-actions">
                {onEdit && (
                  <button className="icon-button small" aria-label="行きたい場所を編集" onClick={() => onEdit(item)}>
                    <Edit3 size={16} />
                  </button>
                )}
                <button className="icon-button small" aria-label="行きたい場所を削除" onClick={() => onDelete(item.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
            ))
          )}
        </div>
      )}
    </section>
  );
}
