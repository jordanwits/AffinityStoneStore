/**
 * Shrinks the oversized product photos already in Supabase Storage, without destroying anything.
 *
 * The storefront serves images exactly as stored (next.config.js has images.unoptimized), and
 * admin uploads are now shrunk in the browser (lib/products/prepare-image-upload.ts), but photos
 * uploaded before that are still 1-4MB each. This gives them the same treatment: long edge capped
 * at 1600px, re-encoded as WebP.
 *
 * Nothing is overwritten. Each shrunk copy is uploaded as a new file next to its original, and only
 * the links in products.images / product_variants.image_url are switched over. Every switch is
 * logged to changes.json, so `undo` can point the links back at the untouched originals. The
 * originals are also downloaded to scripts/output/ first, as a second backup.
 *
 * Usage, from the repo root:
 *   node scripts/shrink-product-images.mjs trial [--count 3|all]   preview only, changes nothing
 *   node scripts/shrink-product-images.mjs apply                   asks for confirmation first
 *   node scripts/shrink-product-images.mjs undo <path to changes.json>
 * Options: --min-kb 1024 (images at least this big are shrunk)
 *
 * Environment:
 *   SUPABASE_URL                e.g. https://vdyzaiuojgrycnaukxlg.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   needed for apply and undo
 *   SUPABASE_ANON_KEY           enough for trial, but then inactive products aren't seen
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const MAX_EDGE = 1600;
const QUALITY = 82;
const BUCKET = 'products';
const SHRINKABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// A re-encode that saves less than this isn't worth swapping the link for.
const MIN_SAVING = 0.2;
const OUTPUT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'output', 'shrink-images');

const args = process.argv.slice(2);
const command = args[0];
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SUPABASE_URL = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim();
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const kb = bytes => `${Math.round(bytes / 1024).toLocaleString()}KB`;
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// ---------------------------------------------------------------------------------------------
// Supabase access (plain fetch, so the script needs nothing beyond sharp)

function authHeaders(key, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

async function rest(key, pathAndQuery, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: authHeaders(key, init.headers),
  });
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${pathAndQuery.split('?')[0]} failed: ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

async function readAll(key, table, select, filter = '') {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const page = await rest(key, `${table}?select=${select}${filter}&order=id`, {
      headers: { Range: `${from}-${from + pageSize - 1}`, 'Range-Unit': 'items' },
    });
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

/** A Postgres array literal, for PostgREST's eq/cs filters on the images column. */
function pgArray(values) {
  const quoted = values.map(v => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  return encodeURIComponent(`{${quoted.join(',')}}`);
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadNew(objectPath, data) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: authHeaders(SERVICE_KEY, {
      'Content-Type': 'image/webp',
      'Cache-Control': 'max-age=3600',
      'x-upsert': 'false',
    }),
    body: data,
  });
  if (res.ok) return;
  const body = await res.text();
  // Left over from an earlier, interrupted run: same source, same settings, so same file.
  if (/already exists|duplicate/i.test(body)) return;
  throw new Error(`upload failed: ${res.status} ${body}`);
}

// ---------------------------------------------------------------------------------------------
// Finding and shrinking

async function findOversized(key, minBytes) {
  const products = await readAll(key, 'products', 'id,name,images');
  const variants = await readAll(key, 'product_variants', 'id,product_id,image_url', '&image_url=not.is.null');
  const productName = new Map(products.map(p => [p.id, p.name]));

  const byUrl = new Map();
  const note = (url, label) => {
    if (typeof url !== 'string' || !url.startsWith(PUBLIC_PREFIX)) return;
    const entry = byUrl.get(url) ?? { url, objectPath: decodeURIComponent(url.slice(PUBLIC_PREFIX.length)), uses: new Set() };
    entry.uses.add(label);
    byUrl.set(url, entry);
  };
  for (const p of products) for (const url of p.images ?? []) note(url, p.name);
  for (const v of variants) note(v.image_url, `${productName.get(v.product_id) ?? 'unknown product'} (variant)`);

  const entries = [...byUrl.values()];
  for (let i = 0; i < entries.length; i += 8) {
    await Promise.all(entries.slice(i, i + 8).map(async entry => {
      const res = await fetch(entry.url, { method: 'HEAD' });
      entry.size = res.ok ? Number(res.headers.get('content-length')) || 0 : 0;
      entry.type = res.headers.get('content-type')?.split(';')[0] ?? '';
    }));
  }

  return {
    productCount: products.length,
    linkedImages: entries.length,
    oversized: entries
      .filter(e => e.size >= minBytes && SHRINKABLE_TYPES.has(e.type))
      .sort((a, b) => b.size - a.size),
  };
}

async function shrink(original) {
  const before = await sharp(original).metadata();
  const { data, info } = await sharp(original)
    .rotate() // apply the EXIF orientation before the flag is dropped
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer({ resolveWithObject: true });
  return { data, before: `${before.width}x${before.height}`, after: `${info.width}x${info.height}` };
}

function shrunkPath(objectPath) {
  const dot = objectPath.lastIndexOf('.');
  if (dot <= objectPath.lastIndexOf('/')) return `${objectPath}-${MAX_EDGE}.webp`;
  // The old extension stays in the name: photo.jpg and photo.png both became photo-1600.webp,
  // and the second upload failed because the first had taken the name.
  return `${objectPath.slice(0, dot)}-${objectPath.slice(dot + 1)}-${MAX_EDGE}.webp`;
}

function printCandidates({ productCount, linkedImages, oversized }, minBytes) {
  const total = oversized.reduce((sum, e) => sum + e.size, 0);
  console.log(`\n${productCount} products link to ${linkedImages} images in storage.`);
  console.log(`${oversized.length} of them are ${kb(minBytes)} or more (${kb(total)} in total):\n`);
  for (const e of oversized) {
    console.log(`  ${kb(e.size).padStart(8)}  ${e.objectPath}  <- ${[...e.uses].join(', ')}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Commands

async function trial() {
  const key = SERVICE_KEY || ANON_KEY;
  if (!key) fail('Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.');
  if (!SERVICE_KEY) console.log('Using the anon key: inactive products are not visible, so the list may be short.');

  const minBytes = Number(option('min-kb', 1024)) * 1024;
  const found = await findOversized(key, minBytes);
  printCandidates(found, minBytes);
  if (found.oversized.length === 0) return;

  const countOption = option('count', '3');
  const picked = countOption === 'all' ? found.oversized : found.oversized.slice(0, Number(countOption));
  const dir = path.join(OUTPUT_ROOT, `trial-${stamp()}`);
  await fs.mkdir(dir, { recursive: true });

  const rows = [];
  let before = 0;
  let after = 0;
  for (const [i, e] of picked.entries()) {
    const original = await download(e.url);
    const result = await shrink(original);
    const n = String(i + 1).padStart(2, '0');
    const originalFile = `${n}-original${path.extname(e.objectPath) || '.img'}`;
    const shrunkFile = `${n}-shrunk.webp`;
    await fs.writeFile(path.join(dir, originalFile), original);
    await fs.writeFile(path.join(dir, shrunkFile), result.data);
    before += original.length;
    after += result.data.length;
    console.log(`  ${e.objectPath}: ${result.before} ${kb(original.length)} -> ${result.after} ${kb(result.data.length)}`);
    rows.push({ e, originalFile, shrunkFile, originalSize: original.length, shrunkSize: result.data.length, ...result });
  }

  await fs.writeFile(path.join(dir, 'compare.html'), compareHtml(rows));
  console.log(`\nTrial images: ${kb(before)} -> ${kb(after)}. Nothing in Supabase was changed.`);
  console.log(`Open ${path.join(dir, 'compare.html')} to compare them side by side.\n`);
}

async function apply() {
  if (!SERVICE_KEY) fail('apply needs SUPABASE_SERVICE_ROLE_KEY.');
  const minBytes = Number(option('min-kb', 1024)) * 1024;
  const found = await findOversized(SERVICE_KEY, minBytes);
  printCandidates(found, minBytes);
  if (found.oversized.length === 0) return;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `\nShrink these ${found.oversized.length} images? Originals stay in storage; only links change. Type yes to continue: `
  );
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') fail('Stopped. Nothing was changed.');

  const dir = path.join(OUTPUT_ROOT, `run-${stamp()}`);
  await fs.mkdir(path.join(dir, 'originals'), { recursive: true });
  const logPath = path.join(dir, 'changes.json');
  const log = { supabaseUrl: SUPABASE_URL, startedAt: new Date().toISOString(), changes: [] };
  const saveLog = () => fs.writeFile(logPath, JSON.stringify(log, null, 2));
  await saveLog();
  console.log(`\nBacking up originals and logging changes to ${dir}\n`);

  // Ctrl+C used to kill the run partway through relinking an image, before the log was saved,
  // so undo never heard about the rows already changed. Now it finishes the current image,
  // saves the log and stops. A second Ctrl+C quits at once.
  let stopping = false;
  const onInterrupt = () => {
    if (stopping) process.exit(130);
    stopping = true;
    console.log('\nStopping after this image (Ctrl+C again to quit now)...');
  };
  process.on('SIGINT', onInterrupt);

  for (const e of found.oversized) {
    if (stopping) break;
    const label = e.objectPath;
    try {
      const original = await download(e.url);
      await fs.writeFile(path.join(dir, 'originals', e.objectPath.replace(/\//g, '__')), original);

      const result = await shrink(original);
      if (result.data.length > original.length * (1 - MIN_SAVING)) {
        console.log(`  skip ${label}: only ${kb(original.length)} -> ${kb(result.data.length)}`);
        continue;
      }

      const newPath = shrunkPath(e.objectPath);
      const newUrl = PUBLIC_PREFIX + newPath;
      await uploadNew(newPath, result.data);
      const check = await fetch(newUrl, { method: 'HEAD' });
      if (!check.ok) throw new Error(`new file not reachable (${check.status}), links left alone`);

      const change = {
        oldUrl: e.url,
        newUrl,
        originalBytes: original.length,
        newBytes: result.data.length,
        products: [],
        variants: [],
        conflicts: [],
      };
      log.changes.push(change);
      try {
        await swapLinks(e.url, newUrl, change);
      } finally {
        // Saved even if relinking stopped partway, so undo still knows about the rows it did.
        await saveLog();
      }

      const where = `${change.products.length} product(s), ${change.variants.length} variant(s)`;
      const conflicts = change.conflicts.length ? `, ${change.conflicts.length} skipped (edited meanwhile)` : '';
      console.log(`  ${label}: ${kb(original.length)} -> ${kb(result.data.length)}, relinked ${where}${conflicts}`);
    } catch (err) {
      console.log(`  FAILED ${label}: ${err.message}`);
    }
  }

  process.off('SIGINT', onInterrupt);
  if (stopping) log.stoppedEarly = true;
  log.finishedAt = new Date().toISOString();
  await saveLog();
  if (stopping) console.log(`\nStopped early; ${log.changes.length} image(s) were changed and logged.`);
  console.log(`\nDone. The storefront picks up the new links within about 5 minutes (its product cache).`);
  console.log(`To put everything back:\n  node scripts/shrink-product-images.mjs undo "${logPath}"\n`);
}

/**
 * Point every row that links `fromUrl` at `toUrl`. Rows are re-read here rather than taken from the
 * earlier scan, and each write only lands if the row still holds what was read, so an admin editing
 * a product while this runs never has their edit overwritten.
 */
async function swapLinks(fromUrl, toUrl, record) {
  const products = await rest(SERVICE_KEY, `products?select=id,images&images=cs.${pgArray([fromUrl])}`);
  for (const p of products) {
    const updated = await rest(SERVICE_KEY, `products?id=eq.${p.id}&images=eq.${pgArray(p.images)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ images: p.images.map(url => (url === fromUrl ? toUrl : url)) }),
    });
    (updated.length ? record.products : record.conflicts).push(p.id);
  }

  const variants = await rest(
    SERVICE_KEY,
    `product_variants?image_url=eq.${encodeURIComponent(fromUrl)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ image_url: toUrl }),
    }
  );
  record.variants.push(...variants.map(v => v.id));
}

async function undo() {
  if (!SERVICE_KEY) fail('undo needs SUPABASE_SERVICE_ROLE_KEY.');
  const logPath = args[1];
  if (!logPath) fail('Usage: node scripts/shrink-product-images.mjs undo <path to changes.json>');
  const log = JSON.parse(await fs.readFile(logPath, 'utf8'));
  if (log.supabaseUrl !== SUPABASE_URL) fail(`That log is for ${log.supabaseUrl}, but SUPABASE_URL is ${SUPABASE_URL}.`);

  console.log(`\nPointing ${log.changes.length} image link(s) back at their originals...\n`);
  for (const change of log.changes) {
    const record = { products: [], variants: [], conflicts: [] };
    await swapLinks(change.newUrl, change.oldUrl, record);
    const conflicts = record.conflicts.length ? `, ${record.conflicts.length} skipped (edited meanwhile, rerun undo)` : '';
    console.log(`  ${change.oldUrl.slice(PUBLIC_PREFIX.length)}: restored ${record.products.length} product(s), ${record.variants.length} variant(s)${conflicts}`);
  }
  console.log('\nDone. The shrunk -1600.webp copies are still in storage, unused; delete them in the Supabase dashboard if you like.\n');
}

// ---------------------------------------------------------------------------------------------

function compareHtml(rows) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const items = rows.map(r => `
  <section>
    <h2>${esc([...r.e.uses].join(', '))}</h2>
    <p class="file">${esc(r.e.objectPath)}</p>
    <div class="pair">
      <figure><a href="${r.originalFile}" target="_blank"><img src="${r.originalFile}"></a>
        <figcaption>Original: ${r.before}, ${kb(r.originalSize)}</figcaption></figure>
      <figure><a href="${r.shrunkFile}" target="_blank"><img src="${r.shrunkFile}"></a>
        <figcaption>Shrunk: ${r.after}, ${kb(r.shrunkSize)}</figcaption></figure>
    </div>
  </section>`).join('\n');
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Image shrink trial</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #111; background: #fff; }
  h1 { font-size: 20px; } h2 { font-size: 16px; margin: 0; } .file { color: #666; font-size: 13px; margin: 4px 0 12px; }
  section { margin-bottom: 40px; } .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  img { width: 100%; height: auto; border: 1px solid #ddd; } figure { margin: 0; } figcaption { font-size: 14px; margin-top: 6px; }
  @media (max-width: 700px) { .pair { grid-template-columns: 1fr; } }
</style></head><body>
<h1>Image shrink trial: originals vs. shrunk (${MAX_EDGE}px max, WebP quality ${QUALITY})</h1>
<p>Click either image to open it at full size and zoom in. Nothing in Supabase was changed.</p>
${items}
</body></html>
`;
}

if (!SUPABASE_URL) fail('Set SUPABASE_URL, e.g. https://vdyzaiuojgrycnaukxlg.supabase.co');
const commands = { trial, apply, undo };
if (!commands[command]) fail('Usage: node scripts/shrink-product-images.mjs trial|apply|undo (see the comment at the top of the file)');
await commands[command]();
