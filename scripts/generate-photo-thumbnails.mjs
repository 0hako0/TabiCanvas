import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const BUCKET = 'travel-photos';
const THUMBNAIL_MAX_SIZE = 560;
const THUMBNAIL_QUALITY = 72;
const MAX_ROWS = 5000;

loadEnvFile('.env.local');

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  console.error('Example: $env:SUPABASE_SERVICE_ROLE_KEY="xxxxx"; npm run photos:thumbnails');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let processed = 0;
let created = 0;
let skipped = 0;
let failed = 0;

const { data: photos, error } = await supabase
  .from('photos')
  .select('id, couple_id, visit_id, storage_path, original_url, original_storage_path, thumbnail_url, thumbnail_storage_path')
  .or('thumbnail_storage_path.is.null,thumbnail_url.is.null')
  .order('created_at', { ascending: true })
  .limit(MAX_ROWS);

if (error) {
  console.error('Failed to load photos:', error.message);
  process.exit(1);
}

if ((photos?.length ?? 0) === MAX_ROWS) {
  console.warn(`Loaded ${MAX_ROWS} photos. Run this script again if more rows remain.`);
}

for (const photo of photos ?? []) {
  processed += 1;
  try {
    const originalPathOrUrl = photo.original_storage_path ?? photo.storage_path ?? photo.original_url;
    if (!originalPathOrUrl) {
      skipped += 1;
      console.warn(`skip ${photo.id}: original path/url is missing`);
      continue;
    }

    if (!photo.couple_id) {
      skipped += 1;
      console.warn(`skip ${photo.id}: couple_id is missing`);
      continue;
    }

    const thumbnailPath = `${photo.couple_id}/${photo.visit_id}/thumbnails/${photo.id}.webp`;
    const originalBytes = await loadOriginalImage(originalPathOrUrl);
    const thumbnailBytes = await sharp(originalBytes)
      .rotate()
      .resize({
        width: THUMBNAIL_MAX_SIZE,
        height: THUMBNAIL_MAX_SIZE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer();

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(thumbnailPath, thumbnailBytes, {
      contentType: 'image/webp',
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from('photos')
      .update({
        thumbnail_url: thumbnailPath,
        thumbnail_storage_path: thumbnailPath,
        original_storage_path: photo.original_storage_path ?? (isHttpUrl(originalPathOrUrl) ? photo.storage_path : originalPathOrUrl),
      })
      .eq('id', photo.id);
    if (updateError) throw updateError;

    created += 1;
    console.log(`created thumbnail: ${photo.id} -> ${thumbnailPath}`);
  } catch (error) {
    failed += 1;
    console.error(`failed ${photo.id}:`, error.message ?? error);
  }
}

console.log(JSON.stringify({ processed, created, skipped, failed }, null, 2));

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

async function loadOriginalImage(pathOrUrl) {
  if (isHttpUrl(pathOrUrl)) {
    const response = await fetch(pathOrUrl);
    if (!response.ok) throw new Error(`failed to fetch original url: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  const { data, error } = await supabase.storage.from(BUCKET).download(pathOrUrl);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

function isHttpUrl(value) {
  return /^https?:\/\//.test(value);
}
