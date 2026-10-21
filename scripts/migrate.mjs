// npm run migrate — apply pending migrations (the app also runs them on first API request).
import { MongoClient } from 'mongodb';
import { runMigrations } from '../lib/db/migrate.js';

const client = await MongoClient.connect(process.env.MONGO_URL);
try {
  const ran = await runMigrations(client.db(process.env.DB_NAME || 'boro_nest'));
  console.log(ran.length ? `applied: ${ran.join(', ')}` : 'nothing to apply');
} finally {
  await client.close();
}
