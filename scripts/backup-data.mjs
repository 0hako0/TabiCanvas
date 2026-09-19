// TabiCanvasのDB実データ（旅行記録・wishlist・写真メタ情報など）を
// ローカルにJSONとしてエクスポートするスクリプト。
//
// テーブル構造・RLSポリシー・Storageバケット設定は supabase/schema.sql に
// 記録済みのため、このスクリプトはデータ（行）のバックアップのみを担当する。
//
// 使い方:
//   1. .env.local に以下を設定する（Gitにはコミットしないこと）
//        SUPABASE_URL=https://xxxx.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=xxxxxxxx
//      Service Role KeyはSupabase Dashboard > Project Settings > API から取得できる。
//      RLSを経由せず全データを取得するためService Role Keyが必要。
//   2. npm run backup:data
//   3. backups/<日時>/ 配下にテーブルごとのJSONファイルが出力される
//   4. 出力先ディレクトリを手動（またはお使いの同期ツール）でNAS等へコピーする
//
// 実DBデータには個人的な旅行メモ等が含まれる可能性があるため、
// backups/ ディレクトリはGitにコミットしない（.gitignoreで除外済み）。

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const TABLES = [
  'couples',
  'couple_members',
  'profiles',
  'prefecture_visits',
  'visit_locations',
  'photos',
  'visit_comments',
  'tags',
  'wishlist',
  'notifications',
  'push_subscriptions',
  'user_settings',
];

loadEnvFile('.env.local');

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  console.error('Example: $env:SUPABASE_SERVICE_ROLE_KEY="xxxxx"; npm run backup:data');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(process.cwd(), 'backups', timestamp);
fs.mkdirSync(outDir, { recursive: true });

const summary = {};

for (const table of TABLES) {
  const rows = await fetchAllRows(table);
  if (rows === null) continue;
  const filePath = path.join(outDir, `${table}.json`);
  fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf8');
  summary[table] = rows.length;
  console.log(`backed up ${table}: ${rows.length} rows`);
}

fs.writeFileSync(
  path.join(outDir, '_meta.json'),
  JSON.stringify({ created_at: new Date().toISOString(), supabase_url: supabaseUrl, tables: summary }, null, 2),
  'utf8',
);

console.log(`\nbackup written to ${outDir}`);
console.log(JSON.stringify(summary, null, 2));

async function fetchAllRows(table) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`failed to read ${table}:`, error.message);
      return null;
    }

    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function loadEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (!process.env[key]) {
      process.env[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
    }
  }
}
