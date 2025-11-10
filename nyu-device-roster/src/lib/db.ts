import mongoose from "mongoose";

import { getMongoConnectionUri } from "@/lib/secrets";

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var __mongoConnectionPromise: Promise<typeof mongoose> | null | undefined;
}

let cachedConnection: typeof mongoose | null = null;

const connectionTimeoutMs = 30_000;

export async function connectToDatabase(uri?: string): Promise<typeof mongoose> {
  const resolvedUri = uri ?? (await getMongoConnectionUri());

  if (cachedConnection) {
    return cachedConnection;
  }

  if (!global.__mongoConnectionPromise) {
    global.__mongoConnectionPromise = mongoose.connect(resolvedUri, {
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
