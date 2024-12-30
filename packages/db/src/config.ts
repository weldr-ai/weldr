import type { Config } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL ?? "";

export default {
  schema: [
    "./src/schema/auth.ts",
    "./src/schema/conversations.ts",
    "./src/schema/endpoints.ts",
    "./src/schema/integrations.ts",
    "./src/schema/funcs.ts",
    "./src/schema/resources.ts",
    "./src/schema/projects.ts",
    "./src/schema/environment-variables.ts",
    "./src/schema/test-runs.ts",
    "./src/schema/dependencies.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: connectionString },
} satisfies Config;
