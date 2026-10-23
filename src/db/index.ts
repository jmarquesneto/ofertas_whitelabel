import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Reaproveita o pool entre hot-reloads no dev
const g = globalThis as unknown as { __pgPool?: Pool };

export const pool =
  g.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX ?? 10),
  });

if (process.env.NODE_ENV !== "production") g.__pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
