import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
};

const conn =
  globalForDb.conn ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.APP_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
export * from "drizzle-orm";

export type Tx = typeof db.transaction extends (
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  callback: (tx: infer T) => any,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
) => any
  ? T
  : never;
export type Db = typeof db;
