import { readFileSync, writeFileSync } from "node:fs";
import path, { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineIntegration } from "@/integrations/utils/integration-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const postgresqlIntegration = await defineIntegration<"postgresql">({
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
  packages: (options) => {
    if (options?.orm === "drizzle") {
      return {
        add: {
          runtime: {
            "drizzle-orm": "^0.44.2",
            "drizzle-zod": "^0.7.1",
            postgres: "^3.4.7",
          },
          development: {
            "drizzle-kit": "^0.31.4",
          },
        },
      };
    }
  },
  dirMap: {
    "standalone-backend": {
      server: "src",
      "config/*": ".",
    },
    "full-stack": {
      server: "server",
      "config/*": ".",
    },
  },
  scripts: async (options) => {
    const orm = options?.orm;
    if (orm === "drizzle") {
      return {
        "db:check": "drizzle-kit check",
        "db:generate": "drizzle-kit generate",
        "db:migrate": "drizzle-kit migrate",
        "db:push": "drizzle-kit push",
        "db:pull": "drizzle-kit pull",
      };
    }
  },
  preInstall: async (context) => {
    const project = context.get("project");

    if (project.type === "full-stack") {
      // For full-stack projects, update the template to use "./server/" instead of "./src/"
      try {
        const templatePath = join(__dirname, "data", "drizzle.config.ts.hbs");
        const templateContent = readFileSync(templatePath, "utf8");

        // Replace "./src/" with "./server/" in the template
        const updatedContent = templateContent.replace(
          /\.\/src\//g,
          "./server/",
        );

        writeFileSync(templatePath, updatedContent);
      } catch (error) {
        return {
          success: false,
          message:
            "Failed to update drizzle.config.ts template for full-stack project",
          errors: [
            `Error updating template: ${error instanceof Error ? error.message : String(error)}`,
          ],
        };
      }
    }

    return {
      success: true,
      message:
        "Successfully ran drizzle-postgresql integration pre-install hook",
    };
  },
});
