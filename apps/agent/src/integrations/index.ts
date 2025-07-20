import { runCommand } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import { WorkflowContext } from "@/workflow/context";

import type { Integration, IntegrationKey } from "@weldr/shared/types";
import { integrationRegistry } from "./registry";

// Export main registry and types
export { integrationRegistry } from "./registry";
export type {
  IntegrationCallback,
  IntegrationCallbackResult,
  IntegrationDefinition,
} from "./types";
// Export utilities
export { combineResults } from "./utils/integration-core";
export { installPackages, runPnpmScript } from "./utils/packages";

async function main() {
  try {
    // Ensure .temp directory exists
    const workspace = await runCommand("mkdir", ["-p", WORKSPACE_DIR]);

    if (!workspace.success) {
      console.error(`Failed to create ${WORKSPACE_DIR} directory`);
      return;
    }

    // Create a mock workflow context for testing
    const context = new WorkflowContext();

    // Mock required context data (adjust these values as needed)
    context.set("project", {
      id: "test-project",
      title: "Test Project",
      subdomain: "test-project",
      config: new Set(["backend", "frontend"]),
      initiatedAt: null,
      userId: "test-user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    context.set("version", {
      id: "test-version",
      number: 1,
      message: "Test version",
      description: null,
      status: "pending" as const,
      acceptanceCriteria: null,
      commitHash: null,
      chatId: "test-chat",
      changedFiles: [],
      activatedAt: new Date(),
      parentVersionId: null,
      userId: "test-user",
      projectId: "test-project",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    context.set("user", {
      id: "test-user",
      name: "Test User",
      email: "test@example.com",
      emailVerified: false,
      image: null,
      role: null,
      banned: null,
      banReason: null,
      banExpires: null,
      stripeCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // List of integrations to install
    const integrationsToInstall: IntegrationKey[] = [
      "orpc",
      "tanstack-start",
      "postgresql",
      "better-auth",
    ];

    const resolvedIntegrations = integrationRegistry.resolveInstallationOrder(
      integrationsToInstall,
    );

    console.log(`Installing integrations in: ${WORKSPACE_DIR}`);

    console.log(`Resolved integrations: ${resolvedIntegrations.join(" -> ")}`);

    // Install integrations one by one
    for (const integrationKey of resolvedIntegrations) {
      try {
        console.log(`\n--- Installing ${integrationKey} integration ---`);

        const integration = integrationRegistry.get(integrationKey);
        console.log(`Found integration: ${integration.key}`);

        // Install the integration with specific options per integration type
        if (integrationKey === "postgresql") {
          await integrationRegistry.install({
            integration: {
              id: "test-integration",
              status: "installed" as const,
              createdAt: new Date(),
              userId: "test-user",
              projectId: "test-project" as string,
              key: "postgresql",
              category: "database",
              options: { orm: "drizzle" as const },
              integrationTemplateId: "test-template" as string,
              environmentVariableMappings: [
                {
                  environmentVariable: {
                    id: "test-env-var",
                    key: "DATABASE_URL",
                    secretId: "test-secret",
                    projectId: "test-project",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    userId: "test-user",
                  },
                  integrationId: "test-integration",
                  mapTo: "DATABASE_URL",
                  environmentVariableId: "test-env-var",
                },
              ],
            },
            context,
          });
        } else if (integrationKey === "better-auth") {
          await integrationRegistry.install({
            integration: {
              id: "test-integration",
              status: "installed" as const,
              createdAt: new Date(),
              userId: "test-user",
              projectId: "test-project" as string,
              key: "better-auth",
              category: "authentication",
              options: {
                socialProviders: ["google", "github"] as (
                  | "google"
                  | "github"
                  | "microsoft"
                )[],
                plugins: ["admin", "stripe"] as (
                  | "admin"
                  | "oAuthProxy"
                  | "openAPI"
                  | "organization"
                  | "stripe"
                )[],
                emailVerification: true,
                emailAndPassword: true,
                stripeIntegration: true,
              },
              integrationTemplateId: "test-template" as string,
              environmentVariableMappings: [
                {
                  environmentVariable: {
                    id: "test-env-var",
                    key: "BETTER_AUTH_SECRET",
                    secretId: "test-secret",
                    projectId: "test-project",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    userId: "test-user",
                  },
                  integrationId: "test-integration",
                  mapTo: "BETTER_AUTH_SECRET",
                  environmentVariableId: "test-env-var",
                },
              ],
            },
            context,
          });
        } else {
          // hono, tanstack-start, etc.
          await integrationRegistry.install({
            integration: {
              id: "test-integration",
              status: "installed" as const,
              createdAt: new Date(),
              userId: "test-user",
              projectId: "test-project" as string,
              key: integrationKey,
              category: integration.category,
              options: null,
              integrationTemplateId: "test-template" as string,
            } as Integration,
            context,
          });
        }

        console.log(`✅ Successfully installed ${integrationKey} integration`);
      } catch (error) {
        console.error(
          `❌ Failed to install ${integrationKey} integration:`,
          error,
        );
      }
    }

    console.log(
      `\n🎉 Integration installation complete! Check ${WORKSPACE_DIR} for installed files.`,
    );
  } catch (error) {
    console.error("Error in main function:", error);
  }
}

main().catch(console.error);
