import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var __mongoConnectionPromise: Promise<typeof mongoose> | null | undefined;
}

let cachedConnection: typeof mongoose | null = null;

const connectionTimeoutMs = 30_000;

export async function connectToDatabase(uri = process.env.MONGODB_URI): Promise<typeof mongoose> {
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is required to connect to MongoDB");
  }

  if (cachedConnection) {
    return cachedConnection;
  }

  if (!global.__mongoConnectionPromise) {
    global.__mongoConnectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: connectionTimeoutMs,
    });
  }

  cachedConnection = await global.__mongoConnectionPromise;
  return cachedConnection;
}

export function resetDatabaseConnectionForTests() {
  cachedConnection = null;
  global.__mongoConnectionPromise = null;
}

export default connectToDatabase;
