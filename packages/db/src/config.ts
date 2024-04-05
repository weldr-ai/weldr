import type { Config } from "drizzle-kit";

export const connectionString = process.env.DB_URL ?? "";

export default {
  schema: "./src/schema/*",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: { connectionString },
} satisfies Config;
