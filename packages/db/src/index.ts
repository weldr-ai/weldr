import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { connectionString } from "./config";
import * as auth from "./schema/auth";

export * from "drizzle-orm";

export const schema = { ...auth };

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
