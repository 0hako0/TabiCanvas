import { FormEvent, useState } from 'react';
import { Copy, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Props = {
  onReady: () => void;
};

export function CoupleSetup({ onReady }: Props) {
  const [name, setName] = useState('ふたりの旅');
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function createCouple(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const { data, error } = await supabase.rpc('create_couple', { couple_name: name });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setInviteCode(data);
    onReady();
  }

  async function joinCouple(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const { error } = await supabase.rpc('join_couple_by_invite_code', { code: inviteCode.trim() });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    onReady();
  }

  return (
    <main className="page-shell setup-shell">
      <section className="panel setup-panel">
        <Users size={32} />
        <h1>ふたりの旅アルバムを作成</h1>
        <p>最初に夫婦共有スペースを作るか、招待コードで参加してください。</p>

        <form className="stack" onSubmit={createCouple}>
          <label>
            アルバム名
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <button className="primary-button" disabled={loading}>新しく作成</button>
        </form>

        <div className="divider">または</div>

        <form className="stack" onSubmit={joinCouple}>
          <label>
            招待コード
            <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} />
          </label>
          <button className="secondary-button" disabled={loading}>参加する</button>
        </form>

        {inviteCode && (
          <button className="copy-pill" onClick={() => navigator.clipboard.writeText(inviteCode)}>
            <Copy size={16} />
            招待コード: {inviteCode}
          </button>
        )}
        {message && <p className="form-message">{message}</p>}
      </section>
    </main>
  );
}
