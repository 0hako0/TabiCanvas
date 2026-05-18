import { FormEvent, useState } from 'react';
import { LockKeyhole, LogIn, Mail, MapPinned } from 'lucide-react';
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

  async function signInWithGoogle() {
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setLoading(false);
      setMessage(error.message);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-subtle">
        <div className="auth-subtle-map" aria-hidden="true" />
        <div className="brand-mark auth-brand-mark">
          <MapPinned size={25} />
        </div>
        <p className="eyebrow">TRAVEL MEMORY MAP</p>
        <h1>TabiCanvas</h1>
        <p className="lead">旅の思い出を、日本地図に描いていこう</p>
        <p className="auth-subcopy">行った場所、撮った写真、忘れたくない瞬間をひとつの地図に。</p>

        <form onSubmit={handleSubmit} className="stack auth-form">
          <label>
            メールアドレス
            <span className="input-with-icon">
              <Mail size={18} />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </span>
          </label>
          <label>
            パスワード
            <span className="input-with-icon">
              <LockKeyhole size={18} />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                placeholder="パスワードを入力"
                minLength={6}
                required
              />
            </span>
          </label>
          <button className="primary-button auth-submit" disabled={loading}>
            <LogIn size={18} />
            {loading ? '処理中...' : mode === 'signIn' ? 'ログイン' : 'アカウント作成'}
          </button>
        </form>

        <div className="auth-divider">
          <span>または</span>
        </div>
        <button className="google-button" type="button" onClick={signInWithGoogle} disabled={loading}>
          <span className="google-mark">G</span>
          Googleでログイン
        </button>

        {message && <p className="form-message">{message}</p>}
        <button className="text-button auth-switch" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          {mode === 'signIn' ? 'はじめての方はこちら' : 'ログインに戻る'}
        </button>
      </section>
    </main>
  );
}
