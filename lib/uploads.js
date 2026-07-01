import { v4 as uuid } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

export async function ensureUploadDir(subdir = '') {
  const dir = path.join(UPLOAD_ROOT, subdir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// Accepts a Web File (from formData) and saves it. Returns { url, filename, size, type, absolutePath }.
export async function saveUploadedFile(file, subdir = '') {
  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = (file.name || 'upload').replace(/[^\w.\-]+/g, '_');
  const filename = `${uuid()}-${safeName}`;
  const dir = await ensureUploadDir(subdir);
  const absolutePath = path.join(dir, filename);
  await fs.writeFile(absolutePath, buf);
  const url = `/uploads/${subdir ? subdir + '/' : ''}${filename}`;
  return { url, filename: safeName, size: buf.length, type: file.type || 'application/octet-stream', absolutePath };
}

export function humanSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
