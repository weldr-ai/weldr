// TODO: Generate a secret for the integration

import crypto from "node:crypto";
import { db } from "@weldr/db";
import {
  environmentVariables,
  integrationEnvironmentVariables,
  secrets,
} from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type { IntegrationPackageSets } from "@/integrations/types";
import { defineIntegration } from "@/integrations/utils/integration-core";

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
    const hasWeb = project.config.has("web");

    const packages: IntegrationPackageSets = [
      {
        target: "server",
        runtime: {
          "better-auth": "^1.3.1",
        },
        development: {},
      },
    ];

    if (hasWeb) {
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
  postInstall: async ({ context, integration }) => {
    const user = context.get("user");
    const project = context.get("project");

    const BETTER_AUTH_SECRET = await crypto.randomBytes(32).toString("hex");

    try {
      return await db.transaction(async (tx) => {
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

        return {
          success: true,
          message: "Successfully installed Better-Auth",
        };
      });
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
