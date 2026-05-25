import { FormEvent, useMemo, useState } from 'react';
import { AlertTriangle, Download, Loader2, RotateCcw, Trash2, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

type Props = {
  profile: Profile;
  inviteCode?: string;
  onChanged: () => Promise<void> | void;
};

type ActionState = 'idle' | 'exporting' | 'deactivating' | 'restoring' | 'deleting';

function daysUntil(dateText?: string | null) {
  if (!dateText) return null;
  const due = new Date(dateText).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((due - now) / (1000 * 60 * 60 * 24)));
}

export function AccountManagement({ profile, inviteCode, onChanged }: Props) {
  const [action, setAction] = useState<ActionState>('idle');
  const [message, setMessage] = useState('');
  const [deactivateText, setDeactivateText] = useState('');
  const [deleteText, setDeleteText] = useState('');
  const remainingDays = useMemo(() => daysUntil(profile.deletion_due_at), [profile.deletion_due_at]);

  async function callFunction<T>(name: string) {
    const { data, error } = await supabase.functions.invoke<T>(name);
    if (error) throw error;
    return data;
  }

  async function exportData() {
    setAction('exporting');
    setMessage('');
    try {
      const data = await callFunction<Record<string, unknown>>('account-export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `tabicanvas-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('エクスポートJSONを作成しました。写真はJSON内のdownload_urlから保存できます。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'エクスポートに失敗しました。');
    } finally {
      setAction('idle');
    }
  }

  async function deactivateAccount(event: FormEvent) {
    event.preventDefault();
    if (deactivateText !== '停止') return;
    setAction('deactivating');
    setMessage('');
    try {
      await callFunction('account-deactivate');
      setMessage('アカウントを停止しました。30日以内なら復元できます。');
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '停止に失敗しました。');
    } finally {
      setAction('idle');
    }
  }

  async function restoreAccount() {
    setAction('restoring');
    setMessage('');
    try {
      await callFunction('account-restore');
      setMessage('アカウントを復元しました。');
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '復元に失敗しました。');
    } finally {
      setAction('idle');
    }
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    if (deleteText !== '削除') return;
    setAction('deleting');
    setMessage('');
    try {
      await callFunction('account-delete');
      await supabase.auth.signOut();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '完全削除に失敗しました。');
      setAction('idle');
    }
  }

  const isBusy = action !== 'idle';
  const isStopped = profile.account_status && profile.account_status !== 'active';

  return (
    <section className="account-management">
      <section className="settings-section profile-settings">
        <div className="profile-avatar">{profile.nickname.slice(0, 1)}</div>
        <div>
          <h3>{profile.nickname}</h3>
          {inviteCode && <p>招待コード: <strong>{inviteCode}</strong></p>}
        </div>
      </section>

      <section className="settings-section">
        <h3>通知</h3>
        <label className="settings-toggle">
          <span>
            <strong>アプリ内通知</strong>
            <small>思い出・写真・行きたい場所の追加をアプリ内で受け取ります。</small>
          </span>
          <input type="checkbox" checked readOnly />
        </label>
        <label className="settings-toggle">
          <span>
            <strong>プッシュ通知</strong>
            <small>次の段階で対応予定です。現在はアプリ内通知のみ使えます。</small>
          </span>
          <input type="checkbox" disabled />
        </label>
      </section>

      <div className="section-title danger-title">
        <AlertTriangle size={18} />
        <h2>アカウント管理</h2>
      </div>
      <p className="account-help">
        退会前に旅の思い出データを保存できます。停止中は新しい投稿や写真追加を控え、30日以内なら復元できます。
      </p>

      <button className="secondary-button" onClick={exportData} disabled={isBusy}>
        {action === 'exporting' ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
        データをエクスポート
      </button>

      {isStopped && (
        <div className="account-warning">
          <strong>アカウントは停止中です</strong>
          <p>
            完全削除予定日: {profile.deletion_due_at ? new Date(profile.deletion_due_at).toLocaleDateString('ja-JP') : '未設定'}
          </p>
          {remainingDays !== null && <p>あと{remainingDays}日以内なら復元できます。</p>}
          <button className="primary-button" onClick={restoreAccount} disabled={isBusy}>
            {action === 'restoring' ? <Loader2 className="spin" size={18} /> : <RotateCcw size={18} />}
            アカウントを復元する
          </button>
        </div>
      )}

      {!isStopped && (
        <form className="danger-form danger-stop" onSubmit={deactivateAccount}>
          <div>
            <strong>アカウントを停止する</strong>
            <p>30日間の復元期間を設けます。実行するには「停止」と入力してください。</p>
          </div>
          <input value={deactivateText} onChange={(event) => setDeactivateText(event.target.value)} placeholder="停止" />
          <button className="danger-button stop" disabled={isBusy || deactivateText !== '停止'}>
            {action === 'deactivating' ? <Loader2 className="spin" size={18} /> : <UserX size={18} />}
            停止する
          </button>
        </form>
      )}

      <form className="danger-form danger-delete" onSubmit={deleteAccount}>
        <div>
          <strong>アカウントを完全削除する</strong>
          <p>この操作は元に戻せません。本人が作成したデータ、写真、メンバー情報を削除します。</p>
        </div>
        <input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder="削除" />
        <button className="danger-button solid" disabled={isBusy || deleteText !== '削除'}>
          {action === 'deleting' ? <Loader2 className="spin" size={18} /> : <Trash2 size={18} />}
          完全削除する
        </button>
      </form>

      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
