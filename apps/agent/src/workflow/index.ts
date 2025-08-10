import { and, db, eq, isNotNull, or } from "@weldr/db";
import { type chatMessages, projects, users, versions } from "@weldr/db/schema";

import { getInstalledCategories } from "@/integrations/utils/get-installed-categories";
import { WorkflowContext } from "./context";
import { createStep, createWorkflow } from "./engine";
import { codeStep } from "./steps/code";
import { deployStep } from "./steps/deploy";
import { planStep } from "./steps/plan";
import { requirementsStep } from "./steps/requirements";

const isDev = process.env.NODE_ENV === "development";

export const workflow = createWorkflow({
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
  .onStatus("pending", requirementsStep)
  .onStatus("planning", planStep)
  .onStatus("coding", codeStep)
  .onStatus(
    "deploying",
    isDev
      ? createStep({
          id: "dev-skip-deploy",
          execute: async ({ context }) => {
            // Skip deployment in development
            const version = context.get("version");

            console.log(
              `[dev-skip-deploy] Updating version ${version.id} from ${version.status} to completed`,
            );

            await db
              .update(versions)
              .set({ status: "completed" })
              .where(eq(versions.id, version.id));

            const updatedVersion = { ...version, status: "completed" as const };
            context.set("version", updatedVersion);

            console.log(
              `[dev-skip-deploy] Context updated. New status: ${context.get("version").status}`,
            );
          },
        })
      : deployStep,
  );

export async function recoverWorkflow() {
  let project: typeof projects.$inferSelect | undefined;

  if (process.env.NODE_ENV === "development") {
    project = await db.query.projects.findFirst({
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    });
  } else if (process.env.NODE_ENV === "production") {
    project = await db.query.projects.findFirst({
      // biome-ignore lint/style/noNonNullAssertion: reason
      where: eq(projects.id, process.env.PROJECT_ID!),
      with: {
        integrations: {
          with: {
            integrationTemplate: {
              with: {
                category: true,
              },
            },
          },
        },
      },
    });
  }

  if (!project) {
    throw new Error("Project not found");
  }

  const installedCategories = await getInstalledCategories(project.id);

  const user = await db.query.users.findFirst({
    where: eq(users.id, project.userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  let version:
    | (typeof versions.$inferSelect & {
        chat?: {
          messages: (typeof chatMessages.$inferSelect)[];
        };
      })
    | undefined;

  version = await db.query.versions.findFirst({
    where: and(
      eq(versions.projectId, project.id),
      isNotNull(versions.activatedAt),
      or(
        eq(versions.status, "planning"),
        eq(versions.status, "coding"),
        eq(versions.status, "deploying"),
      ),
    ),
  });

  if (!version) {
    const pendingVersion = await db.query.versions.findFirst({
      where: and(
        eq(versions.projectId, project.id),
        isNotNull(versions.activatedAt),
        eq(versions.status, "pending"),
      ),
      with: {
        chat: {
          with: {
            messages: {
              orderBy: (messages, { desc }) => [desc(messages.createdAt)],
              limit: 1,
            },
          },
        },
      },
    });

    if (pendingVersion?.chat?.messages[0]?.role !== "user") {
      return;
    }

    version = pendingVersion;
  }

  const context = new WorkflowContext();
  context.set("project", {
    ...project,
    integrationCategories: new Set(installedCategories),
  });
  context.set("version", version);
  context.set("user", user);
  context.set("isXML", true);
  await workflow.execute({ context });
}
