import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

const { Pool } = pg;

export const connectionString = process.env.DATABASE_URL ?? "";

export * from "drizzle-orm";

const pool = new Pool({
  connectionString,
});

void pool.connect();

export const db = drizzle(pool, { schema });
