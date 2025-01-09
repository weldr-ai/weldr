import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "";

export const db = drizzle({
  connection: {
    connectionString,
  },
  schema,
});

export * from "drizzle-orm";

export type Tx = typeof db.transaction extends (
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  callback: (tx: infer T) => any,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
) => any
  ? T
  : never;
export type Db = typeof db;
