import { FormEvent } from 'react';
import { ListPlus, Trash2 } from 'lucide-react';
import type { Prefecture, WishlistFormState, WishlistItem } from '../types';

type Props = {
  selected: Prefecture;
  items: WishlistItem[];
  form: WishlistFormState;
  onFormChange: (form: WishlistFormState) => void;
  onSubmit: (event: FormEvent) => void;
  onDelete: (itemId: string) => void;
};

export function WishlistPanel({ selected, items, form, onFormChange, onSubmit, onDelete }: Props) {
  return (
    <section className="panel wishlist-panel">
      <div className="section-title">
        <ListPlus size={18} />
        <h2>{selected.name}の行きたい場所</h2>
      </div>
      <form className="wishlist-form" onSubmit={onSubmit}>
        <input
          value={form.title}
          onChange={(event) => onFormChange({ ...form, title: event.target.value })}
          placeholder="例: 露天風呂のある宿"
          required
        />
        <input
          value={form.food}
          onChange={(event) => onFormChange({ ...form, food: event.target.value })}
          placeholder="食べたいもの"
        />
        <input
          value={form.sightseeing}
          onChange={(event) => onFormChange({ ...form, sightseeing: event.target.value })}
          placeholder="行きたい観光地"
        />
        <button className="secondary-button">追加</button>
      </form>
      <div className="wishlist-items">
        {items.length === 0 ? (
          <p className="empty compact">まだ行きたい場所はありません。</p>
        ) : (
          items.map((item) => (
            <article key={item.id} className="wishlist-item">
              <div>
                <strong>{item.title}</strong>
                {(item.food || item.sightseeing || item.memo) && (
                  <p>
                    {[item.food, item.sightseeing, item.memo].filter(Boolean).join(' / ')}
                  </p>
                )}
              </div>
              <button className="icon-button small" aria-label="行きたい場所を削除" onClick={() => onDelete(item.id)}>
                <Trash2 size={16} />
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
