import { FormEvent, useState } from 'react';
import { Heart, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const action =
      mode === 'signIn'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await action;

    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(mode === 'signUp' ? '確認メールが有効な場合はメールを確認してください。' : '');
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">
          <Heart size={24} fill="currentColor" />
        </div>
        <p className="eyebrow">Couple travel album</p>
        <h1>TabiCanvas</h1>
        <p className="lead">47都道府県の思い出を、ふたりだけの地図と写真で残しましょう。</p>

        <form onSubmit={handleSubmit} className="stack">
          <label>
            メールアドレス
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label>
            パスワード
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </label>
          <button className="primary-button" disabled={loading}>
            <LogIn size={18} />
            {loading ? '処理中...' : mode === 'signIn' ? 'ログイン' : 'アカウント作成'}
          </button>
        </form>

        {message && <p className="form-message">{message}</p>}
        <button className="text-button" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          {mode === 'signIn' ? 'はじめての方はこちら' : 'ログインに戻る'}
        </button>
      </section>
    </main>
  );
}
