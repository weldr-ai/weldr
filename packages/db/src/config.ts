import type { Config } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL ?? "";

export default {
  schema: [
    "./src/schema/auth.ts",
    "./src/schema/chats.ts",
    "./src/schema/declarations.ts",
    "./src/schema/dependencies.ts",
    "./src/schema/environment-variables.ts",
    "./src/schema/files.ts",
    "./src/schema/packages.ts",
    "./src/schema/presets.ts",
    "./src/schema/projects.ts",
    "./src/schema/shared-enums.ts",
    "./src/schema/versions.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: connectionString },
} satisfies Config;
