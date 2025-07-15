import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineIntegration } from "../utils";

export const postgresqlIntegration = await defineIntegration({
  key: "postgresql",
  name: "PostgreSQL",
  description: "PostgreSQL integration",
  location: "backend",
  scripts: {
    "db:check": "drizzle-kit check",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:pull": "drizzle-kit pull",
  },
  packages: {
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
