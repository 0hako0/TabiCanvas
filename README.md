# TabiCanvas

47都道府県の旅の思い出を、日本地図と写真で残せる旅行アルバムアプリです。

## 方針

- フロントエンドは Vercel 無料枠
- バックエンドは作らず Supabase 無料枠
- Supabase Auth / Database / Storage / RLS で共有と保護を実装
- 写真はアップロード前にブラウザで WebP へリサイズ・圧縮
- Storage は private bucket に保存し、画面表示時だけ署名付きURLを発行

## 技術構成

- React
- TypeScript
- Vite
- Supabase Auth
- Supabase Database
- Supabase Storage
- PWA

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` に Supabase の値を設定します。

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Supabase 設定

1. Supabase で新しいプロジェクトを作成します。
2. `SQL Editor` を開きます。
3. [supabase/schema.sql](./supabase/schema.sql) の内容を貼り付けて実行します。
4. `Authentication > Providers` で Email を有効化します。
5. 本番デプロイ後、`Authentication > URL Configuration` に Vercel の本番URLを追加します。
6. ローカル開発用に `http://localhost:5173` も Redirect URL に追加します。

## Googleログイン設定

### 1. Google Cloud Console 側

1. [Google Cloud Console](https://console.cloud.google.com/) を開きます。
2. プロジェクトを作成、または既存プロジェクトを選択します。
3. `API とサービス > OAuth 同意画面` を開きます。
4. アプリ名、サポートメール、デベロッパー連絡先を入力して保存します。
5. `API とサービス > 認証情報` を開きます。
6. `認証情報を作成 > OAuth クライアント ID` を選びます。
7. アプリケーションの種類は `ウェブ アプリケーション` を選びます。
8. 承認済みの JavaScript 生成元に以下を追加します。
   - `http://localhost:5173`
   - Vercel の本番URL
9. 承認済みのリダイレクト URI に、Supabase の Google callback URL を追加します。
   - Supabase の `Authentication > Providers > Google` に表示される callback URL を使います。
   - 形式は通常 `https://<project-ref>.supabase.co/auth/v1/callback` です。
10. 作成後に表示される `Client ID` と `Client Secret` を控えます。

### 2. Supabase 側

1. Supabase Dashboard で対象プロジェクトを開きます。
2. `Authentication > Providers > Google` を開きます。
3. Google Provider を有効化します。
4. Google Cloud Console で作成した `Client ID` と `Client Secret` を入力します。
5. 保存します。
6. `Authentication > URL Configuration` で以下を設定します。
   - Site URL: Vercel の本番URL
   - Redirect URLs:
     - `http://localhost:5173`
     - Vercel の本番URL

アプリ側では以下の形で `window.location.origin` に戻すため、ローカルと本番の両方に対応できます。

```ts
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: window.location.origin,
  },
});
```

既存のメールアドレスと同じGoogleアカウントでログインした場合、Supabase Auth 側で同一メールのアカウント連携として扱われる想定です。夫婦共有データは `auth.uid()` と `couple_members` を使ったRLSで保護しているため、Googleログイン後も同じユーザーIDで認証されれば既存データを利用できます。

## 主な機能

- ログイン / 新規登録
- Googleログイン
- 夫婦・家族・旅行仲間などの共有アルバム作成
- 招待コードで同じアルバムへ参加
- 日本地図で訪問済み都道府県を色分け
- 都道府県ごとの旅行記録
- 写真アップロード
- 行きたい場所リスト
- 制覇率、地方別進捗、訪問回数
- 思い出タイムライン
- PWA対応

## データ設計

- `couples`: 共有アルバム
- `couple_members`: アルバム参加ユーザー
- `profiles`: ニックネーム
- `prefecture_visits`: 旅行記録
- `visit_locations`: 訪問場所の拡張用
- `photos`: 写真メタ情報
- `visit_comments`: ユーザー別コメント
- `tags`: タグ拡張用
- `wishlist`: 行きたい場所

## RLS と Storage

[supabase/schema.sql](./supabase/schema.sql) にテーブル作成、RLS、RPC、Storage bucket 作成SQLをまとめています。

写真は `travel-photos/{couple_id}/{visit_id}/{photo_id}.webp` に保存します。Storage bucket は private で、RLS により同じ共有アルバムのメンバーだけがアクセスできます。画面表示時は署名付きURLを発行します。

## Vercel デプロイ

Vercel で GitHub リポジトリを Import します。

- Framework Preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

デプロイ後、Supabase の `Authentication > URL Configuration` と Google Cloud Console の OAuth 設定に Vercel の本番URLを追加してください。

## 起動コマンド

```bash
npm run dev
npm run build
npm run preview
```

## アプリ内通知

`supabase/schema.sql` に `notifications` と `push_subscriptions` を追加しています。

- `notifications`: 思い出、写真、行きたい場所の追加をアプリ内で知らせる通知
- `push_subscriptions`: 将来のPWAプッシュ通知用の購読情報

通知は `recipient_user_id` が自分のものだけ読めるRLSです。同じ招待コードのメンバーに対してのみ作成でき、自分自身には通知を作りません。

## アカウント管理

設定の「アカウント管理」から、データエクスポート、アカウント停止、復元、完全削除を実行できます。危険な操作は確認文字の入力が必要です。

Supabase SQL Editorで `supabase/schema.sql` を再実行したあと、Edge Functionsをデプロイしてください。

```bash
supabase functions deploy account-export
supabase functions deploy account-deactivate
supabase functions deploy account-restore
supabase functions deploy account-delete
```

Edge Functionsは `SUPABASE_SERVICE_ROLE_KEY` を使ってサーバー側で本人確認と削除処理を行います。Service Role Keyはフロントエンドの環境変数には絶対に入れないでください。
