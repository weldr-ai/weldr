import type { Config } from "drizzle-kit";

export const connectionString = process.env.DATABASE_URL ?? "";

export default {
  schema: "./src/schema/*",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: connectionString },
} satisfies Config;
