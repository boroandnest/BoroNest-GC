// next.config.js sets output: 'standalone'. Next.js's standalone build does
// NOT copy public/ or .next/static into .next/standalone/ on its own — that
// manual copy step is the documented requirement for standalone deploys
// (https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
// This repo had no public/ assets before the Direction D redesign, so
// nobody had hit this yet: every /redesign/*.webp photo 404'd in production
// because the files were never present next to .next/standalone/server.js.
import { existsSync } from 'fs';
import { cp as cpAsync } from 'fs/promises';
import path from 'path';

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');

async function copyIfExists(from, to) {
  if (!existsSync(from)) return;
  await cpAsync(from, to, { recursive: true, force: true });
  console.log(`[copy-standalone-assets] ${path.relative(root, from)} -> ${path.relative(root, to)}`);
}

async function main() {
  if (!existsSync(standalone)) {
    console.log('[copy-standalone-assets] .next/standalone not found — output is not "standalone" or build failed, nothing to do.');
    return;
  }
  await copyIfExists(path.join(root, 'public'), path.join(standalone, 'public'));
  await copyIfExists(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'));
}

main().catch((e) => { console.error('[copy-standalone-assets] failed:', e); process.exit(1); });
