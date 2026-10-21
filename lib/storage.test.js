// Storage abstraction (P4), local backend + photo compression. S3 backend: lib/storage.s3.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

process.env.UPLOAD_DIR = mkdtempSync(path.join(os.tmpdir(), 'bn-storage-'));
delete process.env.S3_ENDPOINT;
process.env.STORAGE_SIGNING_SECRET = 'test-secret';

const storage = await import('./storage.js');
const { compressPhoto, saveUploadedFile } = await import('./uploads.js');
const sharp = (await import('sharp')).default;

test('local backend: put/get/delete round-trip', async () => {
  assert.equal(storage.storageBackend(), 'local');
  await storage.putObject('a/b/c.txt', Buffer.from('hello'), 'text/plain');
  assert.equal((await storage.getObject('a/b/c.txt')).toString(), 'hello');
  await storage.deleteObject('a/b/c.txt');
  await assert.rejects(() => storage.getObject('a/b/c.txt'));
});

test('path traversal keys are refused', async () => {
  for (const k of ['../x', 'a/../../x', '/etc/passwd/..', '']) {
    await assert.rejects(() => storage.putObject(k, Buffer.from('x')), /invalid storage key/);
  }
});

test('local signed URL verifies, and fails when expired or tampered', async () => {
  const url = await storage.getSignedUrl('docs/coi.pdf', { expiresIn: 60, filename: 'coi.pdf', contentType: 'application/pdf' });
  const params = new URL(url, 'http://x').searchParams;
  assert.deepEqual(storage.verifyLocalSignedUrl(params), { key: 'docs/coi.pdf', disposition: 'attachment; filename="coi.pdf"', contentType: 'application/pdf' });
  const tampered = new URLSearchParams(params); tampered.set('key', 'docs/other.pdf');
  assert.equal(storage.verifyLocalSignedUrl(tampered), null);
  const unsigned = new URLSearchParams(params); unsigned.delete('sig');
  assert.equal(storage.verifyLocalSignedUrl(unsigned), null);
  const expired = new URL(await storage.getSignedUrl('docs/coi.pdf', { expiresIn: -1 }), 'http://x').searchParams;
  assert.equal(storage.verifyLocalSignedUrl(expired), null);
});

async function phonePhoto() {
  // 4032x3024 like a phone camera, with texture so it does not compress trivially
  const w = 4032, h = 3024;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i += 3) {
    const p = i / 3, x = p % w, y = (p / w) | 0;
    raw[i] = (x * 7 + y * 3) & 255; raw[i + 1] = (x ^ y) & 255; raw[i + 2] = ((x * y) >> 6) & 255;
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
}

test('photos are compressed to WebP and resized', async () => {
  const jpg = await phonePhoto();
  const webp = await compressPhoto(jpg);
  const meta = await sharp(webp).metadata();
  assert.equal(meta.format, 'webp');
  assert.ok(Math.max(meta.width, meta.height) <= 2560);
  assert.ok(webp.length * 3 < jpg.length, `expected >3x reduction, got ${jpg.length} -> ${webp.length}`);
});

test('original kept only when flagged as evidence', async () => {
  const jpg = await phonePhoto();
  const file = (name) => new File([jpg], name, { type: 'image/jpeg' });
  const plain = await saveUploadedFile(file('site.jpg'), 'projects/p1', { photo: true });
  assert.equal(plain.originalKey, undefined);
  assert.match(plain.storageKey, /\.webp$/);
  const evidence = await saveUploadedFile(file('violation.jpg'), 'projects/p1', { photo: true, keepOriginal: true });
  assert.match(evidence.originalKey, /\.orig\.jpg$/);
  assert.equal((await storage.getObject(evidence.originalKey)).length, jpg.length);
});
