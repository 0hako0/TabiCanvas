import { FormEvent, useState } from 'react';
import { Camera, Image, LockKeyhole, LogIn, Mail, MapPin, Mountain, NotebookPen, Plane, Route } from 'lucide-react';
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
    <main className="auth-shell auth-shell-travel">
      <section className="auth-card auth-travel-card">
        <div className="auth-illustration" aria-hidden="true">
          <div className="auth-postmark">
            <Mountain size={28} />
            <span>JAPAN TRIP</span>
          </div>
          <Route className="auth-route auth-route-one" size={150} />
          <Route className="auth-route auth-route-two" size={120} />
          <Plane className="auth-plane" size={52} />
          <MapPin className="auth-pin auth-pin-north" size={34} />
          <MapPin className="auth-pin auth-pin-center" size={38} />
          <MapPin className="auth-pin auth-pin-south" size={30} />

          <div className="auth-japan-map">
            <span className="hokkaido" />
            <span className="tohoku" />
            <span className="kanto" />
            <span className="chubu" />
            <span className="kansai" />
            <span className="chugoku" />
            <span className="shikoku" />
            <span className="kyushu" />
            <span className="okinawa" />
          </div>

          <div className="auth-photo-card photo-one">
            <Image size={28} />
          </div>
          <div className="auth-photo-card photo-two">
            <Mountain size={26} />
          </div>
          <div className="auth-camera">
            <Camera size={58} />
          </div>
          <div className="auth-notebook">
            <NotebookPen size={36} />
            <span>Good memories</span>
          </div>

          <div className="auth-illustration-copy">
            <p className="eyebrow">TRAVEL MEMORY MAP</p>
            <h2>旅の思い出を、<br />日本地図に描いていこう</h2>
            <p>行った場所、撮った写真、忘れたくない瞬間をひとつの地図に。</p>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="brand-mark auth-brand-mark">
            <Mountain size={26} />
          </div>
          <p className="eyebrow">TRAVEL MEMORY MAP</p>
          <h1>TabiCanvas</h1>
          <p className="lead">旅の思い出を、日本地図に描いていこう</p>
          <p className="auth-subcopy">行った場所、撮った写真、忘れたくない瞬間をひとつの地図に。</p>

          <form onSubmit={handleSubmit} className="stack auth-form">
            <label>
              メールアドレス
              <span className="input-with-icon">
                <Mail size={19} />
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
                <LockKeyhole size={19} />
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

          {message && <p className="form-message">{message}</p>}
          <button className="text-button auth-switch" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
            {mode === 'signIn' ? 'はじめての方はこちら' : 'ログインに戻る'}
          </button>
        </div>
      </section>
    </main>
  );
}
