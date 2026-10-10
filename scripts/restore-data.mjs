// backup-data.mjs で作成したローカルバックアップ（backups/<日時>/配下のJSON）を
// Supabaseへ書き戻す復元スクリプト。
//
// 前提:
//   - 復元先のSupabaseプロジェクトに、ログインアカウント（Supabase Authのユーザー）が
//     既に存在していること。auth.usersはこのバックアップ/復元の対象外のため、
//     プロジェクトを作り直した場合は先にお二人のアカウントを再作成してから実行すること。
//   - テーブル構造・RLS・Storage設定は supabase/schema.sql を先に流し込んでおくこと。
//
// 使い方:
//   1. .env.local に以下を設定する（Gitにはコミットしないこと）
//        SUPABASE_URL=https://xxxx.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=xxxxxxxx
//   2. npm run restore:data                      -> backups/配下の最新バックアップを復元
//      npm run restore:data -- backups/2026-10-10T00-00-00-000Z -> 指定したバックアップを復元
//   3. 復元対象の件数を表示したあと、実行確認（y/N）を求める
//
// 動作は upsert（id一致なら上書き、なければ追加）のみで、既存データの削除は行わない。
// couples -> couple_members -> profiles -> ... の順で、外部キー関係の親から先に書き込む。

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

const TABLES = [
  { name: 'couples', conflictKey: 'id' },
  { name: 'couple_members', conflictKey: 'id' },
  { name: 'profiles', conflictKey: 'user_id' },
  { name: 'prefecture_visits', conflictKey: 'id' },
  { name: 'visit_locations', conflictKey: 'id' },
  { name: 'photos', conflictKey: 'id' },
  { name: 'visit_comments', conflictKey: 'id' },
  { name: 'tags', conflictKey: 'id' },
  { name: 'wishlist', conflictKey: 'id' },
  { name: 'notifications', conflictKey: 'id' },
  { name: 'push_subscriptions', conflictKey: 'id' },
  { name: 'user_settings', conflictKey: 'user_id' },
];

const BATCH_SIZE = 500;

loadEnvFile('.env.local');

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  console.error('Example: $env:SUPABASE_SERVICE_ROLE_KEY="xxxxx"; npm run restore:data');
  process.exit(1);
}

const backupDir = resolveBackupDir(process.argv[2]);
console.log(`restore source: ${backupDir}`);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rowsByTable = {};
let totalRows = 0;
for (const table of TABLES) {
  const filePath = path.join(backupDir, `${table.name}.json`);
  if (!fs.existsSync(filePath)) {
    rowsByTable[table.name] = [];
    continue;
  }
  const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  rowsByTable[table.name] = rows;
  totalRows += rows.length;
  console.log(`${table.name}: ${rows.length}件`);
}

if (totalRows === 0) {
  console.log('復元対象のデータが見つかりませんでした。');
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`\n合計${totalRows}件をSupabaseへ書き戻します（upsert、既存データの削除は行いません）。続行しますか？ (y/N) `);
rl.close();
if (answer.trim().toLowerCase() !== 'y') {
  console.log('中止しました。');
  process.exit(0);
}

const summary = {};
for (const table of TABLES) {
  const rows = rowsByTable[table.name];
  if (rows.length === 0) {
    summary[table.name] = 0;
    continue;
  }

  let restored = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table.name).upsert(chunk, { onConflict: table.conflictKey });
    if (error) {
      console.error(`failed to restore ${table.name} (rows ${i}-${i + chunk.length}):`, error.message);
      continue;
    }
    restored += chunk.length;
  }
  summary[table.name] = restored;
  console.log(`restored ${table.name}: ${restored}/${rows.length} rows`);
}

console.log('\n復元結果:');
console.log(JSON.stringify(summary, null, 2));

function resolveBackupDir(argPath) {
  if (argPath) {
    const resolved = path.resolve(process.cwd(), argPath);
    if (!fs.existsSync(resolved)) {
      console.error(`指定されたバックアップディレクトリが見つかりません: ${resolved}`);
      process.exit(1);
    }
    return resolved;
  }

  const backupsRoot = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupsRoot)) {
    console.error('backups/ ディレクトリが見つかりません。先に npm run backup:data を実行してください。');
    process.exit(1);
  }

  const entries = fs
    .readdirSync(backupsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (entries.length === 0) {
    console.error('backups/ 配下にバックアップが見つかりません。先に npm run backup:data を実行してください。');
    process.exit(1);
  }

  return path.join(backupsRoot, entries[entries.length - 1]);
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
