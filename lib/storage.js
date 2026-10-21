// The only module that knows where files live.
//
//   S3_ENDPOINT + S3_BUCKET set  -> S3-compatible bucket (Cloudflare R2, AWS S3, MinIO). Private bucket,
//                                   reads go through short-lived presigned URLs.
//   otherwise                    -> local disk under UPLOAD_DIR (default ./storage/uploads). Reads go
//                                   through HMAC-signed, expiring /api/storage/object URLs.
//
// Swapping provider is an environment change only. Everything else calls putObject / getObject /
// getSignedUrl / deleteObject from here.
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';

const LOCAL_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), 'storage', 'uploads');

export function storageBackend() {
  return process.env.S3_ENDPOINT && process.env.S3_BUCKET ? 's3' : 'local';
}

let s3;
function s3Client() {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', // MinIO / moto need path-style
      credentials: { accessKeyId: process.env.S3_KEY || '', secretAccessKey: process.env.S3_SECRET || '' }
    });
  }
  return s3;
}

// Keys are relative paths like "projects/<id>/<uuid>.webp". Never trust a caller-built key with "..".
export function safeKey(key) {
  const k = String(key || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!k || k.split('/').some(part => part === '..' || part === '.')) throw new Error('invalid storage key');
  return k;
}

function localPath(key) {
  const abs = path.resolve(LOCAL_ROOT, safeKey(key));
  if (!abs.startsWith(path.resolve(LOCAL_ROOT) + path.sep)) throw new Error('invalid storage key');
  return abs;
}

export async function putObject(key, body, contentType = 'application/octet-stream') {
  const k = safeKey(key);
  if (storageBackend() === 's3') {
    await s3Client().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: k, Body: body, ContentType: contentType }));
  } else {
    const abs = localPath(k);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, body);
  }
  return { key: k, backend: storageBackend() };
}

// backend defaults to the current one; records written before a switch keep their own backend.
export async function getObject(key, backend = storageBackend()) {
  const k = safeKey(key);
  if (backend === 's3') {
    const out = await s3Client().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: k }));
    return Buffer.from(await out.Body.transformToByteArray());
  }
  return fs.readFile(localPath(k));
}

export async function deleteObject(key, backend = storageBackend()) {
  const k = safeKey(key);
  if (backend === 's3') {
    await s3Client().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: k }));
  } else {
    await fs.rm(localPath(k), { force: true });
  }
}

// ---------- signed URLs ----------
let warned = false;
function signingSecret() {
  if (process.env.STORAGE_SIGNING_SECRET) return process.env.STORAGE_SIGNING_SECRET;
  if (!warned) { console.warn('[storage] STORAGE_SIGNING_SECRET not set; deriving one from MONGO_URL'); warned = true; }
  return crypto.createHash('sha256').update(`bn-storage:${process.env.MONGO_URL || 'dev'}`).digest('hex');
}

function localSignature(key, exp, disposition, type) {
  return crypto.createHmac('sha256', signingSecret()).update(`${key}\n${exp}\n${disposition}\n${type}`).digest('base64url');
}

// Short-lived URL for one object. Call only AFTER the caller's access check.
export async function getSignedUrl(key, { expiresIn = 300, backend = storageBackend(), filename, inline = false, contentType = 'application/octet-stream' } = {}) {
  const k = safeKey(key);
  const disposition = `${inline ? 'inline' : 'attachment'}${filename ? `; filename="${String(filename).replace(/["\r\n]/g, '')}"` : ''}`;
  if (backend === 's3') {
    return presign(
      s3Client(),
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: k, ResponseContentDisposition: disposition, ResponseContentType: contentType }),
      { expiresIn }
    );
  }
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  const qs = new URLSearchParams({ key: k, exp: String(exp), d: disposition, t: contentType, sig: localSignature(k, exp, disposition, contentType) });
  return `/api/storage/object?${qs}`;
}

// Used by /api/storage/object (local backend only).
export function verifyLocalSignedUrl(params) {
  const key = params.get('key');
  const exp = params.get('exp');
  const d = params.get('d') || 'attachment';
  const t = params.get('t') || 'application/octet-stream';
  const sig = params.get('sig');
  if (!key || !exp || !sig) return null;
  if (!/^\d+$/.test(exp) || parseInt(exp, 10) < Math.floor(Date.now() / 1000)) return null;
  const expected = Buffer.from(localSignature(key, exp, d, t));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return { key: safeKey(key), disposition: d, contentType: t };
}
