// SECURITY_HARDENING.md S4 — a renamed executable must be rejected even
// though its filename claims an allowed extension. These fail without the
// magic-byte check in checkUpload().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkUpload } from './uploads.js';

function fakeFile(name, bytes) {
  return new File([Buffer.from(bytes)], name);
}

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]; // "%PDF-1.4"
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const EXE_HEADER = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]; // "MZ..." — Windows PE

test('a real PDF with a .pdf extension passes', async () => {
  assert.equal(await checkUpload(fakeFile('cert.pdf', PDF_HEADER)), null);
});

test('a real PNG with a .png extension passes', async () => {
  assert.equal(await checkUpload(fakeFile('photo.png', PNG_HEADER)), null);
});

test('an executable renamed to .pdf is rejected', async () => {
  const result = await checkUpload(fakeFile('cert.pdf', EXE_HEADER));
  assert.ok(result, 'expected a rejection message');
  assert.match(result, /content doesn't match/i);
});

test('an executable renamed to .jpg (imagesOnly) is rejected', async () => {
  const result = await checkUpload(fakeFile('photo.jpg', EXE_HEADER), { imagesOnly: true });
  assert.ok(result);
});

test('a disallowed extension is rejected regardless of content', async () => {
  const result = await checkUpload(fakeFile('virus.exe', EXE_HEADER));
  assert.match(result, /not allowed/i);
});

test('a PNG renamed to .jpg is rejected (wrong magic bytes for the claimed type)', async () => {
  const result = await checkUpload(fakeFile('photo.jpg', PNG_HEADER));
  assert.ok(result);
});

test('.txt has no magic-byte check — any content with an allowed extension passes', async () => {
  assert.equal(await checkUpload(fakeFile('notes.txt', [0x68, 0x69])), null);
});
