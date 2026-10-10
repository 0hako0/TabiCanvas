// backup-data.mjs で作成したローカルバックアップ（backups/<日時>/配下のJSON）を
// Supabaseへ書き戻す復元スクリプト。
//
// 前提:
//   - 復元先のSupabaseプロジェクトに、ログインアカウント（Supabase Authのユーザー）が
//     既に存在していること。auth.usersの行自体はこのバックアップ/復元の対象外のため、
//     プロジェクトを作り直した場合は先にお二人のアカウントを再作成しておくこと。
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
//
// ユーザーIDの付け替え:
// 別のSupabaseプロジェクトへ復元する場合、サインアップし直すとユーザーIDが
// 変わるため、バックアップ内の旧IDのままでは外部キー（auth.users参照）に
// 一致しない。backup_dir/auth_users.json（backup-data.mjsが保存した旧ID⇔
// メールアドレス一覧）と、復元先プロジェクトの現在のユーザー一覧をメール
// アドレスで突き合わせ、各テーブルのユーザーID項目を新IDへ自動で置き換える。
// 同じプロジェクトに戻すだけ（IDが変わらない）場合は、置き換えは実質何もしない。

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

const TABLES = [
  { name: 'couples', conflictKey: 'id', userIdFields: ['created_by'] },
  { name: 'couple_members', conflictKey: 'id', userIdFields: ['user_id'] },
  { name: 'profiles', conflictKey: 'user_id', userIdFields: ['user_id'] },
  { name: 'prefecture_visits', conflictKey: 'id', userIdFields: ['created_by'] },
  { name: 'visit_locations', conflictKey: 'id', userIdFields: [] },
  { name: 'photos', conflictKey: 'id', userIdFields: ['created_by'] },
  { name: 'visit_comments', conflictKey: 'id', userIdFields: ['user_id'] },
  { name: 'tags', conflictKey: 'id', userIdFields: [] },
  { name: 'wishlist', conflictKey: 'id', userIdFields: ['created_by'] },
  { name: 'notifications', conflictKey: 'id', userIdFields: ['recipient_user_id', 'actor_user_id'] },
  { name: 'push_subscriptions', conflictKey: 'id', userIdFields: ['user_id'] },
  { name: 'user_settings', conflictKey: 'user_id', userIdFields: ['user_id'] },
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

const userIdMap = await buildUserIdMap(backupDir);
if (userIdMap) {
  for (const table of TABLES) {
    if (table.userIdFields.length === 0) continue;
    rowsByTable[table.name] = rowsByTable[table.name].map((row) => remapUserIds(row, table.userIdFields, userIdMap));
  }
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

async function buildUserIdMap(dir) {
  const authUsersPath = path.join(dir, 'auth_users.json');
  if (!fs.existsSync(authUsersPath)) {
    console.log('auth_users.json が見つからないため、ユーザーIDの付け替えはスキップします（同じプロジェクトへの復元を想定）。');
    return null;
  }

  const oldUsers = JSON.parse(fs.readFileSync(authUsersPath, 'utf8'));
  const currentUsers = await fetchAllAuthUsers();
  const currentByEmail = new Map(currentUsers.filter((user) => user.email).map((user) => [user.email.toLowerCase(), user.id]));

  const map = new Map();
  const missing = [];
  for (const oldUser of oldUsers) {
    if (!oldUser.email) continue;
    const newId = currentByEmail.get(oldUser.email.toLowerCase());
    if (!newId) {
      missing.push(oldUser.email);
      continue;
    }
    if (newId !== oldUser.id) map.set(oldUser.id, newId);
  }

  if (missing.length > 0) {
    console.error('復元先プロジェクトにまだサインアップされていないメールアドレスがあります。先にサインアップしてから再実行してください:');
    for (const email of missing) console.error(`  - ${email}`);
    process.exit(1);
  }

  if (map.size > 0) {
    console.log(`ユーザーIDを${map.size}件、新しいIDへ置き換えて復元します。`);
  } else {
    console.log('ユーザーIDは旧プロジェクトと同じため、付け替えは行いません。');
  }
  return map;
}

function remapUserIds(row, fields, userIdMap) {
  const next = { ...row };
  for (const field of fields) {
    const value = next[field];
    if (value && userIdMap.has(value)) next[field] = userIdMap.get(value);
  }
  return next;
}

async function fetchAllAuthUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error('failed to read current auth users:', error.message);
      return users;
    }
    users.push(...data.users.map((user) => ({ id: user.id, email: user.email ?? null })));
    if (data.users.length < 1000) break;
  }
  return users;
}

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
