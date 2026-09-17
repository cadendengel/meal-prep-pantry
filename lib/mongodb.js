import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MONGODB_URI to .env.local');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;

/**
 * Get database instance
 */
export async function getDatabase() {
  const client = await clientPromise;
  return client.db('mealprep');
}

// Index creation runs once per warm serverless instance. The promise is
// cached so that concurrent requests share one round trip.
let indexPromise = null;

/**
 * Create the indexes the queries depend on.
 *
 * - users.email is unique. It stops two concurrent registrations from
 *   creating duplicate accounts for one address.
 * - meals.userId backs every meal query. Without it each query scans the
 *   whole collection.
 */
async function ensureIndexes() {
  const db = await getDatabase();

  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true, name: 'email_unique' }),
    db.collection('meals').createIndex({ userId: 1, updatedAt: -1 }, { name: 'userId_updatedAt' }),
  ]);
}

/**
 * Create indexes at most once per instance.
 *
 * A failure here must not fail the request, so the error is logged and the
 * cached promise is cleared to allow a later retry.
 */
function ensureIndexesOnce() {
  if (!indexPromise) {
    indexPromise = ensureIndexes().catch((error) => {
      console.error('Index creation failed:', error);
      indexPromise = null;
    });
  }
  return indexPromise;
}

/**
 * Get users collection
 */
export async function getUsersCollection() {
  const db = await getDatabase();
  await ensureIndexesOnce();
  return db.collection('users');
}

/**
 * Get meals collection
 */
export async function getMealsCollection() {
  const db = await getDatabase();
  await ensureIndexesOnce();
  return db.collection('meals');
}
