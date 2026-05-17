# TabiCanvas

夫婦で47都道府県制覇を目指すための旅行アルバムアプリです。日本地図で訪問済み都道府県を色付けし、日付、場所、メモ、タグ、写真をふたりだけで共有できます。

## 無料運用方針

TabiCanvasは、できるだけ費用が発生しない構成を前提にしています。

- フロントエンドはVercel無料枠でデプロイ
- 独自バックエンドは作らず、Supabase無料枠を使用
- Supabase Auth、Database、Storage、RLSで認証・保存・共有を完結
- 写真はアップロード前にブラウザでリサイズ・圧縮
- 保存形式はWebPを優先
- 1枚あたり300KB〜800KB程度を目安に圧縮
- Storage bucketはprivateにし、署名付きURLで表示
- 無料枠を超えそうになっても、Supabaseの有料プランや別Storageへ移行しやすい構成

## MVPでできること

- Supabase Authでログイン、アカウント作成
- 夫婦共有スペースの作成、招待コードで参加
- 日本地図から都道府県をクリック
- 訪問回数に応じて都道府県の色を濃く表示
- 旅行記録の登録、削除
- 複数写真アップロード、WebP圧縮
- 47都道府県の制覇率、地方別達成率、旅行回数表示
- 行きたい場所リスト
- 制覇バッジ
- 思い出タイムライン
- PWAとしてホーム画面追加に対応

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

`.env.local` にSupabaseの値を設定します。

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Supabase設定

1. Supabaseで新しいプロジェクトを作成します。
2. `SQL Editor` を開きます。
3. [supabase/schema.sql](./supabase/schema.sql) の内容を貼り付けて実行します。
4. `Authentication > Providers` でEmailログインを有効にします。
5. 本番デプロイ後、`Authentication > URL Configuration` にVercelのURLを追加します。

## テーブル設計

- `couples`: 夫婦単位の共有アルバム
- `couple_members`: 夫婦アルバムに参加しているユーザー
- `prefecture_visits`: 都道府県ごとの旅行記録
- `visit_locations`: 将来の複数スポット管理用
- `photos`: Storageに保存した写真のメタ情報
- `visit_comments`: 将来の夫婦コメント、リアクション、AI日記メモ用
- `tags`: 将来のタグマスタ用
- `wishlist`: 未制覇県の行きたい場所リスト

夫婦共有は `couple_id` を中心に管理します。RLSでは `couple_members` に所属しているユーザーだけが、その夫婦のデータを読み書きできます。

## RLSとStorage

[supabase/schema.sql](./supabase/schema.sql) には以下が含まれています。

- 全テーブルのRLS有効化
- 夫婦メンバー判定関数 `is_couple_member`
- 夫婦作成RPC `create_couple`
- 招待コード参加RPC `join_couple_by_invite_code`
- 旅行記録、写真、タグ、WishlistのRLSポリシー
- 将来の夫婦コメント用 `visit_comments` のRLSポリシー
- `travel-photos` Storage bucket作成
- 写真パス先頭の `couple_id` を使ったStorage RLS

写真はprivate bucketに `travel-photos/{couple_id}/{visit_id}/{photo_id}.webp` の形式で保存します。画面表示時はSupabaseの署名付きURLを発行するため、夫婦メンバー以外は写真を直接閲覧できません。

## 無料枠を超えにくくする工夫

- 写真は元画像をそのまま保存せず、最大辺1440pxに縮小します。
- WebP品質を段階的に調整し、800KB以下を目標にします。
- 旅行記録本文やタグはDatabase、画像本体はStorageに分離します。
- サムネイル専用ファイルはMVPでは作らず、保存枚数を増やしすぎない設計にしています。
- 将来写真が増えた場合は、Storage bucketだけを別サービスに移す、またはSupabase Proへ移行できます。

## Vercelデプロイ

VercelでGitHubリポジトリをImportします。

- Framework Preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

デプロイ後、Supabaseの `Authentication > URL Configuration` にVercelの本番URLを追加してください。

## 起動・ビルド

```bash
npm run dev
npm run build
npm run preview
```

## 今後追加しやすい機能

- 行きたい場所リストの画面化
- SNS風タイムライン
- AI旅行日記生成
- 夫婦それぞれのコメント、リアクション
- 写真から旅行ムービー生成
- Google Map連携
- Apple/Googleフォト連携
- 旅行記念日、カレンダー表示
- 旅行ランキング

## 開発メモ

MVP優先のため、画面構成は `src/App.tsx` を中心にシンプルにしています。初心者でも追いやすいよう、状態管理ライブラリやatomic designは使っていません。将来画面が増えたら、`components`、`lib`、`data` を少しずつ分割していく想定です。
