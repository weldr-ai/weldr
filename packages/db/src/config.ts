import type { Config } from "drizzle-kit";

export const connectionString = process.env.DATABASE_URL ?? "";

export default {
  schema: [
    "./src/schema/auth.ts",
    "./src/schema/conversations.ts",
    "./src/schema/edges.ts",
    "./src/schema/flows.ts",
    "./src/schema/integrations.ts",
    "./src/schema/primitives.ts",
    "./src/schema/resources.ts",
    "./src/schema/workspaces.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: connectionString },
} satisfies Config;
