import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export const connectionString = process.env.DATABASE_URL ?? "";

console.log(connectionString);

export * from "drizzle-orm";

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
