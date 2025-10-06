import { and, db, eq, or } from "@weldr/db";
import { projects, users, versions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";

import { getInstalledCategories } from "@/integrations/utils/get-installed-categories";
import { WorkflowContext } from "./context";
import { createWorkflow } from "./engine";
import { codeStep } from "./steps/code";
import { deployStep } from "./steps/deploy";
import { planStep } from "./steps/plan";

export const workflow = createWorkflow({
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
  .onStatus(["pending", "planning"], planStep)
  .onStatus("coding", codeStep)
  .onStatus("deploying", deployStep);

export async function recoverWorkflow() {
  Logger.info("Recovering workflow");
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

  const versionsList = await db.query.versions.findMany({
    where: and(
      eq(versions.projectId, project.id),
      or(eq(versions.status, "coding"), eq(versions.status, "deploying")),
    ),
    with: {
      branch: true,
    },
  });

  for (const version of versionsList) {
    const context = new WorkflowContext();
    context.set("project", {
      ...project,
      integrationCategories: new Set(installedCategories),
    });
    context.set("branch", { ...version.branch, headVersion: version });
    context.set("user", user);
    await workflow.execute({ context });
    Logger.info(`Recovered workflow for version ${version.id}`);
  }
}
