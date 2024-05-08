import type { Config } from "drizzle-kit";

export const connectionString = process.env.DATABASE_URL ?? "";

export default {
  schema: "./src/schema/*",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: { connectionString },
} satisfies Config;
