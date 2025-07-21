import type {
  IntegrationPackageSets,
  IntegrationScriptSets,
} from "@/integrations/types";
import { defineIntegration } from "@/integrations/utils/integration-core";

export const postgresqlIntegration = defineIntegration<"postgresql">({
  category: "database",
  key: "postgresql",
  name: "PostgreSQL",
  description:
    "Powerful relational database that stores, organizes, and retrieves data with support for complex queries, transactions, and scalable performance.",
  version: "1.0.0",
  allowMultiple: true,
  dependencies: ["backend"],
  variables: [
    {
      name: "DATABASE_URL",
      source: "user",
      isRequired: true,
    },
  ],
  options: {
    orm: ["drizzle", "prisma"],
  },
  packages: async (_, options) => {
    if (options?.orm === "drizzle") {
      const packages: IntegrationPackageSets = [
        {
          target: "server",
          runtime: {
            "drizzle-orm": "^0.44.3",
            "drizzle-zod": "^0.8.2",
            postgres: "^3.4.7",
          },
          development: {
            "drizzle-kit": "^0.31.4",
          },
        },
      ];

      return packages;
    } else {
      throw new Error("Unsupported ORM");
    }
  },
  scripts: async (_, options) => {
    const orm = options?.orm;
    if (orm === "drizzle") {
      const scripts: IntegrationScriptSets = [
        {
          target: "server",
          scripts: {
            "db:check": "drizzle-kit check",
            "db:generate": "drizzle-kit generate",
            "db:migrate": "drizzle-kit migrate",
            "db:push": "drizzle-kit push",
            "db:pull": "drizzle-kit pull",
          },
        },
        {
          target: "root",
          scripts: {
            "db:check": "turbo -F @repo/server db:check",
            "db:generate": "turbo -F @repo/server db:generate",
            "db:migrate": "turbo -F @repo/server db:migrate",
            "db:push": "turbo -F @repo/server db:push",
            "db:pull": "turbo -F @repo/server db:pull",
          },
        },
      ];

      return scripts;
    } else {
      throw new Error("Unsupported ORM");
    }
  },
});
