import { v4 as uuid } from 'uuid';
import path from 'path';
import sharp from 'sharp';
import { putObject, getObject } from './storage.js';

// Files never live under /public. They go through lib/storage (S3-compatible bucket or local disk)
// and are served only after an access check (/api/files/:id) or via a short-lived signed URL.

const ALLOWED_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.heic', '.dwg', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
const CONTENT_TYPES = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.heic': 'image/heic', '.dwg': 'application/acad', '.txt': 'text/plain',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.heic'];

// Photos: ~3 MB phone images become ~400 KB WebP that is still legible as evidence.
const PHOTO_MAX_EDGE = 2560;
const PHOTO_QUALITY = 80;

// SECURITY_HARDENING.md S4 — the claimed extension (and the client's claimed
// content-type) are both just a filename and a header the uploader chose;
// neither proves what the bytes actually are. This checks the real file
// signature for the formats a browser could render or a server could be
// tricked into mis-handling. .heic/.dwg/.doc/.xls/.txt have no single
// reliable magic number worth asserting here — extension allow-listing
// (checked above, and already in place) is what actually covers them.
const MAGIC = {
  '.pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  '.png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  '.jpg': (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  '.jpeg': (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  '.webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  // .docx/.xlsx are zip containers; .doc/.xls are OLE compound files. Checking
  // the container signature still catches a renamed executable or script —
  // it just can't tell a docx from an xlsx (both are "a zip"), which is fine:
  // the extension already said which one this claims to be.
  '.docx': (b) => b.subarray(0, 2).toString('latin1') === 'PK',
  '.xlsx': (b) => b.subarray(0, 2).toString('latin1') === 'PK',
  '.doc': (b) => b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  '.xls': (b) => b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
};

export async function checkUpload(file, { imagesOnly = false } = {}) {
  const ext = path.extname(file.name || '').toLowerCase();
  const allowed = imagesOnly ? IMAGE_EXT : ALLOWED_EXT;
  if (!allowed.includes(ext)) return `File type ${ext || '(none)'} is not allowed`;
  const check = MAGIC[ext];
  if (check) {
    const head = Buffer.from(await file.slice(0, 16).arrayBuffer());
    if (!check(head)) return `File content doesn't match its ${ext} extension`;
  }
  return null;
}

export async function compressPhoto(buf) {
  return sharp(buf, { failOn: 'error' })
    .rotate() // honour EXIF orientation before metadata is dropped
    .resize({ width: PHOTO_MAX_EDGE, height: PHOTO_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: PHOTO_QUALITY })
    .toBuffer();
}

// Saves a Web File (from formData). Returns the record fields to persist in the `files` collection.
// photo: true      -> stored as compressed WebP
// keepOriginal     -> the untouched original is ALSO stored (only for photos flagged as evidence)
export async function saveUploadedFile(file, prefix = '', { photo = false, keepOriginal = false } = {}) {
  const original = Buffer.from(await file.arrayBuffer());
  const safeName = (file.name || 'upload').replace(/[^\w.\-]+/g, '_').slice(-120);
  const ext = path.extname(safeName).toLowerCase();
  const id = uuid();
  const dir = prefix.replace(/[^\w\-\/]+/g, '_').replace(/\.\.+/g, '_').replace(/^\/+|\/+$/g, '');
  const base = dir ? `${dir}/${id}` : id;

  if (photo) {
    const webp = await compressPhoto(original);
    const stored = await putObject(`${base}.webp`, webp, 'image/webp');
    const rec = {
      id, filename: safeName.replace(/\.[^.]+$/, '') + '.webp', size: webp.length, type: 'image/webp',
      storageKey: stored.key, backend: stored.backend, originalSize: original.length
    };
    if (keepOriginal) {
      const orig = await putObject(`${base}.orig${ext}`, original, CONTENT_TYPES[ext] || 'application/octet-stream');
      rec.originalKey = orig.key;
      rec.evidence = true;
    }
    return rec;
  }

  const type = CONTENT_TYPES[ext] || 'application/octet-stream';
  const stored = await putObject(`${base}${ext}`, original, type);
  return { id, filename: safeName, size: original.length, type, storageKey: stored.key, backend: stored.backend };
}

// Reads a stored file record. Records from before lib/storage used `storagePath` on local disk.
export async function readStoredFile(rec) {
  return getObject(rec.storageKey || rec.storagePath, rec.backend || 'local');
}

export function humanSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
