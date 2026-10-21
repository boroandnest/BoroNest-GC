// One-time per-process setup shared by every API route.
import { getDb } from '../mongo.js';
import { ensureAuthIndexes, ensureAdmin } from '../auth.js';
import { ensureSeeded } from '../seed.js';
import { runMigrations } from '../db/migrate.js';

let ready;
export function bootstrap() {
  if (!ready) {
    ready = (async () => {
      await ensureAuthIndexes();
      await ensureAdmin();
      await runMigrations(await getDb());
      await ensureSeeded();
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}
