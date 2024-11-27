import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL ?? "";

const pool = new Pool({
  connectionString,
});

void pool.connect();

export const db = drizzle({
  client: pool,
  schema,
});

export * from "drizzle-orm";
