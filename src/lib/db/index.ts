import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Retry fetch once on connection failure (Neon scale-to-zero cold start)
const originalFetch = globalThis.fetch;
neonConfig.fetchFunction = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    return await originalFetch(input, init);
  } catch {
    return originalFetch(input, init);
  }
};

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });
