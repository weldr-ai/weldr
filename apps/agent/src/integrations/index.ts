import { runCommand } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import { WorkflowContext } from "@/workflow/context";

import type { IntegrationKey } from "@weldr/shared/types";
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
      config: new Set(["server", "web"]),
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
    const integrationsToInstall: IntegrationKey[] = ["postgresql", "orpc"];

    console.log(`Installing integrations in: ${WORKSPACE_DIR}`);

    // Install integrations one by one
    for (const integrationKey of integrationsToInstall) {
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
              options: { orm: "drizzle" as const },
              integrationTemplateId: "test-template" as string,
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
              options: null,
              integrationTemplateId: "test-template" as string,
            },
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
