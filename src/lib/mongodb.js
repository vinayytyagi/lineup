import { MongoClient } from "mongodb";

let cached = global.__mongoClientCache;

if (!cached) {
  cached = global.__mongoClientCache = { client: null, clientPromise: null };
}

export async function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Add it to your environment (e.g. .env.local).",
    );
  }

  if (cached.client) return cached.client;
  if (!cached.clientPromise) {
    const client = new MongoClient(uri);
    cached.clientPromise = client.connect();
  }
  cached.client = await cached.clientPromise;
  return cached.client;
}

export async function getDb() {
  const client = await getMongoClient();
  const dbName = process.env.MONGODB_DB || "lineup";
  return client.db(dbName);
}

let ensuredIndexesPromise = null;

export async function getTasksCollection() {
  const db = await getDb();
  const collection = db.collection("tasks");

  if (!ensuredIndexesPromise) {
    ensuredIndexesPromise = (async () => {
      await collection.createIndex({ scheduledDate: 1 });
      await collection.createIndex({ scheduledDate: 1, order: 1 });
      await collection.createIndex({ createdAt: -1 });
    })();
  }

  await ensuredIndexesPromise;
  return collection;
}

let ensuredUsersIndexesPromise = null;

export async function getUsersCollection() {
  const db = await getDb();
  const collection = db.collection("users");

  if (!ensuredUsersIndexesPromise) {
    ensuredUsersIndexesPromise = (async () => {
      await collection.createIndex({ email: 1 }, { unique: true });
      await collection.createIndex({ createdAt: -1 });
    })();
  }

  await ensuredUsersIndexesPromise;
  return collection;
}
