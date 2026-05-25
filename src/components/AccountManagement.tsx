import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Loader2, RotateCcw, Trash2, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

type Props = {
  profile: Profile;
  inviteCode?: string;
  inAppNotificationsEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
  onSettingsChanged?: () => Promise<void> | void;
  onChanged: () => Promise<void> | void;
};

type ActionState = 'idle' | 'exporting' | 'deactivating' | 'restoring' | 'deleting' | 'saving-settings';
type ConfirmAction = 'deactivate' | 'delete' | null;

function daysUntil(dateText?: string | null) {
  if (!dateText) return null;
  const due = new Date(dateText).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((due - now) / (1000 * 60 * 60 * 24)));
}

export function AccountManagement({
  profile,
  inviteCode,
  inAppNotificationsEnabled = true,
  pushNotificationsEnabled = false,
  onSettingsChanged,
  onChanged,
}: Props) {
  const [action, setAction] = useState<ActionState>('idle');
  const [message, setMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [inAppEnabled, setInAppEnabled] = useState(inAppNotificationsEnabled);
  const remainingDays = useMemo(() => daysUntil(profile.deletion_due_at), [profile.deletion_due_at]);

  useEffect(() => {
    setInAppEnabled(inAppNotificationsEnabled);
  }, [inAppNotificationsEnabled]);

  async function callFunction<T>(name: string) {
    const { data, error } = await supabase.functions.invoke<T>(name);
    if (error) throw error;
    return data;
  }

  async function saveInAppNotificationSetting(nextValue: boolean) {
    const previousValue = inAppEnabled;
    setInAppEnabled(nextValue);
    setAction('saving-settings');
    setMessage('');
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('ログイン情報を確認できませんでした。');
      const { error } = await supabase.from('user_settings').upsert(
        {
          user_id: data.user.id,
          in_app_notifications_enabled: nextValue,
          push_notifications_enabled: pushNotificationsEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
      setMessage(nextValue ? 'アプリ内通知をオンにしました。' : 'アプリ内通知をオフにしました。');
      await onSettingsChanged?.();
    } catch (error) {
      setInAppEnabled(previousValue);
      setMessage(error instanceof Error ? error.message : '通知設定の保存に失敗しました。');
    } finally {
      setAction('idle');
    }
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
      setMessage('エクスポート用JSONを作成しました。写真はJSON内のdownload_urlから保存できます。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'エクスポートに失敗しました。');
    } finally {
      setAction('idle');
    }
  }

  async function deactivateAccount() {
    setAction('deactivating');
    setMessage('');
    try {
      await callFunction('account-deactivate');
      setConfirmAction(null);
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

  async function deleteAccount() {
    setAction('deleting');
    setMessage('');
    try {
      await callFunction('account-delete');
      setConfirmAction(null);
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
          {inviteCode && (
            <p>
              招待コード: <strong>{inviteCode}</strong>
            </p>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h3>通知</h3>
        <label className="settings-toggle">
          <span>
            <strong>アプリ内通知</strong>
            <small>思い出・写真・行きたい場所の追加をアプリ内で受け取ります。</small>
          </span>
          <input
            type="checkbox"
            checked={inAppEnabled}
            disabled={isBusy}
            onChange={(event) => saveInAppNotificationSetting(event.target.checked)}
          />
        </label>
        <label className="settings-toggle is-disabled">
          <span>
            <strong>プッシュ通知</strong>
            <small>次の段階で対応予定です。現在はアプリ内通知のみ使えます。</small>
          </span>
          <input type="checkbox" checked={pushNotificationsEnabled} disabled readOnly />
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
        <div className="danger-form danger-stop">
          <div>
            <strong>アカウントを停止する</strong>
            <p>30日間の復元期間を設けます。停止中は新しい思い出や写真の追加を控えます。</p>
          </div>
          <button className="danger-button stop" type="button" disabled={isBusy} onClick={() => setConfirmAction('deactivate')}>
            <UserX size={18} />
            停止する
          </button>
        </div>
      )}

      <div className="danger-form danger-delete">
        <div>
          <strong>アカウントを完全削除する</strong>
          <p>この操作は元に戻せません。本人が作成したデータ、写真、メンバー情報を削除します。</p>
        </div>
        <button className="danger-button solid" type="button" disabled={isBusy} onClick={() => setConfirmAction('delete')}>
          <Trash2 size={18} />
          完全削除する
        </button>
      </div>

      {message && <p className="form-message">{message}</p>}

      {confirmAction && (
        <div className="confirm-overlay" role="dialog" aria-modal="true">
          <section className="confirm-dialog">
            <div className="section-title danger-title">
              <AlertTriangle size={18} />
              <h2>{confirmAction === 'deactivate' ? 'アカウントを停止しますか？' : 'アカウントを完全削除しますか？'}</h2>
            </div>
            {confirmAction === 'deactivate' ? (
              <p>
                アカウントを停止すると、新しい思い出や写真の追加はできなくなります。30日以内であれば復元できます。
              </p>
            ) : (
              <p>
                この操作は元に戻せません。あなたが作成した思い出、写真、行きたい場所、通知、メンバー情報が削除されます。
                相手のアカウントや相手が作成したデータは削除しません。
              </p>
            )}
            <div className="confirm-actions">
              <button className="secondary-button" type="button" disabled={isBusy} onClick={() => setConfirmAction(null)}>
                キャンセル
              </button>
              <button
                className={confirmAction === 'deactivate' ? 'danger-button stop solid-ish' : 'danger-button solid'}
                type="button"
                disabled={isBusy}
                onClick={confirmAction === 'deactivate' ? deactivateAccount : deleteAccount}
              >
                {action === 'deactivating' || action === 'deleting' ? <Loader2 className="spin" size={18} /> : null}
                {confirmAction === 'deactivate' ? '停止する' : '完全削除する'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
