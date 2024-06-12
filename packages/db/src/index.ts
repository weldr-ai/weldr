import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export const connectionString = process.env.DATABASE_URL ?? "";

export * from "drizzle-orm";

const pool = new Pool({
  connectionString,
});

await pool.connect();

export const db = drizzle(pool, { schema });
