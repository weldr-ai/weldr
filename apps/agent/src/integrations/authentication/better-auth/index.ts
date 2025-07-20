import crypto from "node:crypto";
import path from "node:path";
import { runCommand } from "@/ai/utils/commands";
import type { IntegrationPackageSets } from "@/integrations/types";
import { defineIntegration } from "@/integrations/utils/integration-core";
import { WORKSPACE_DIR } from "@/lib/constants";

import { db } from "@weldr/db";
import {
  environmentVariables,
  integrationEnvironmentVariables,
  secrets,
} from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";

export const betterAuthIntegration = await defineIntegration({
  category: "authentication",
  key: "better-auth",
  name: "Better-Auth",
  description:
    "Modern, self-hosted authentication solution with complete user management, social logins, and session handling.",
  version: "1.0.0",
  allowMultiple: false,
  options: {
    socialProviders: ["github", "google", "microsoft"],
    plugins: ["admin", "oAuthProxy", "openAPI", "organization", "stripe"],
    emailVerification: true,
    emailAndPassword: true,
    stripeIntegration: true,
  },
  variables: [
    {
      name: "BETTER_AUTH_SECRET",
      source: "system",
      isRequired: true,
    },
  ],
  dependencies: ["backend", "database"],
  packages: async (context) => {
    const project = context.get("project");
    const hasFrontend = project.config.has("frontend");

    const packages: IntegrationPackageSets = [
      {
        target: "server",
        runtime: {
          "better-auth": "^1.3.1",
        },
        development: {},
      },
    ];

    if (hasFrontend) {
      packages.push({
        target: "web",
        runtime: {
          "better-auth": "^1.3.1",
        },
        development: {},
      });
    }

    return packages;
  },
  preInstall: async ({ context, integration }) => {
    const user = context.get("user");
    const project = context.get("project");

    try {
      // Store secret in database
      await db.transaction(async (tx) => {
        // Generate secret
        const BETTER_AUTH_SECRET = await crypto
          .randomBytes(32)
          .toString("base64");

        const [secret] = await tx
          .insert(secrets)
          .values({
            secret: BETTER_AUTH_SECRET,
          })
          .returning();

        if (!secret) {
          throw new Error("Failed to generate secret");
        }

        const [environmentVariable] = await tx
          .insert(environmentVariables)
          .values({
            key: "BETTER_AUTH_SECRET",
            projectId: project.id,
            userId: user.id,
            secretId: secret.id,
          })
          .returning();

        if (!environmentVariable) {
          throw new Error("Failed to generate environment variable");
        }

        await tx.insert(integrationEnvironmentVariables).values({
          integrationId: integration.id,
          mapTo: "BETTER_AUTH_SECRET",
          environmentVariableId: environmentVariable.id,
        });
      });

      // Generate schema
      const generateSchemaResult = await runCommand(
        "pnpm",
        [
          "dlx",
          "@better-auth/cli@latest",
          "generate",
          "--config",
          "src/lib/auth.ts",
          "--output",
          "src/db/schema/auth.ts",
          "--y",
        ],
        {
          cwd: path.join(WORKSPACE_DIR, "apps", "server"),
        },
      );

      if (!generateSchemaResult.success) {
        throw new Error(
          `Failed to generate schema for Better-Auth: ${generateSchemaResult.stderr}`,
        );
      }

      // Add re-export to schema index file
      const schemaIndexPath = path.join(
        WORKSPACE_DIR,
        "apps/server/src/db/schema/index.ts",
      );

      const appendResult = await runCommand(
        "sh",
        ["-c", `echo 'export * from "./auth";' | tee -a ${schemaIndexPath}`],
        {
          cwd: WORKSPACE_DIR,
        },
      );

      if (!appendResult.success) {
        throw new Error(
          `Failed to append to schema index file: ${appendResult.stderr}`,
        );
      }

      return {
        success: true,
        message: "Successfully generated schema for Better-Auth",
      };
    } catch (error) {
      Logger.error(
        `Failed to run post-install hook while setting up Better-Auth: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        message: "Failed to run post-install hook while setting up Better-Auth",
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  },
});
