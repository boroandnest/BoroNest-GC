import { MongoClient } from 'mongodb';

const dbName = process.env.DB_NAME || 'boro_nest';

// Connect on first use, not on import. Importing this module used to construct a
// MongoClient immediately, so any build step that merely loads a route file —
// `next build` collecting page data, for one — crashed when MONGO_URL was unset,
// with `Cannot read properties of undefined (reading 'startsWith')` from deep
// inside the driver. Nothing here opens a socket until a query actually asks.
function clientPromise() {
  if (!global._mongoClientPromise) {
    const uri = process.env.MONGO_URL;
    if (!uri) throw new Error('MONGO_URL is not set');
    global._mongoClientPromise = new MongoClient(uri).connect();
  }
  return global._mongoClientPromise;
}

export async function getDb() {
  const client = await clientPromise();
  return client.db(dbName);
}

export async function getCollection(name) {
  const db = await getDb();
  return db.collection(name);
}
