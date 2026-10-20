import { v4 as uuid } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';

// Files are stored OUTSIDE /public so they are never served without an access check.
// They are streamed back through GET /api/files/:id.
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), 'storage', 'uploads');

const ALLOWED_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.heic', '.dwg', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
const CONTENT_TYPES = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.heic': 'image/heic', '.dwg': 'application/acad', '.txt': 'text/plain',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.heic'];

export function checkUpload(file, { imagesOnly = false } = {}) {
  const ext = path.extname(file.name || '').toLowerCase();
  const allowed = imagesOnly ? IMAGE_EXT : ALLOWED_EXT;
  if (!allowed.includes(ext)) return `File type ${ext || '(none)'} is not allowed`;
  return null;
}

// Accepts a Web File (from formData) and saves it. Returns { id, filename, size, type, storagePath }.
export async function saveUploadedFile(file, subdir = '') {
  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = (file.name || 'upload').replace(/[^\w.\-]+/g, '_').slice(-120);
  const ext = path.extname(safeName).toLowerCase();
  const id = uuid();
  const safeSubdir = subdir.replace(/[^\w\-\/]+/g, '_').replace(/\.\.+/g, '_');
  const dir = path.join(UPLOAD_ROOT, safeSubdir);
  await fs.mkdir(dir, { recursive: true });
  const storagePath = path.join(safeSubdir, `${id}${ext}`);
  await fs.writeFile(path.join(UPLOAD_ROOT, storagePath), buf);
  return { id, filename: safeName, size: buf.length, type: CONTENT_TYPES[ext] || 'application/octet-stream', storagePath };
}

export async function readStoredFile(storagePath) {
  const abs = path.resolve(UPLOAD_ROOT, storagePath);
  if (!abs.startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) throw new Error('Invalid path');
  return fs.readFile(abs);
}

export function humanSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
