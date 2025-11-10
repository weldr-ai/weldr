import { and, db, eq, inArray } from "@weldr/db";
import { projects, users, versions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import { getActiveProjectIds, isLocalMode } from "@weldr/shared/state";

import { getInstalledCategories } from "@/integrations/utils/get-installed-categories";
import { WorkflowContext } from "./context";
import { createWorkflow } from "./engine";
import {
  codingStep,
  finalizingStep,
  generateBranchNameStep,
  generateProjectInfoStep,
  generateVersionDetailsStep,
  planningStep,
} from "./steps";

export const workflow = createWorkflow({
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
  .step(planningStep, {
    condition: (context) => {
      const status = context.get("branch").headVersion.status;
      return status === "planning";
    },
  })
  .step(generateProjectInfoStep, {
    condition: (context) => {
      const project = context.get("project");
      const status = context.get("branch").headVersion.status;
      return status === "coding" && (!project.title || !project.description);
    },
  })
  .step(generateBranchNameStep, {
    condition: (context) => {
      const branch = context.get("branch");
      const hasPlaceholderName =
        branch.name?.startsWith("variant/") ||
        branch.name?.startsWith("stream/");
      return hasPlaceholderName;
    },
  })
  .step(generateVersionDetailsStep, {
    condition: (context) => {
      const branch = context.get("branch");
      const status = branch.headVersion.status;
      return (
        status === "coding" &&
        (!branch.headVersion.message || !branch.headVersion.description)
      );
    },
  })
  .step(codingStep, {
    condition: (context) => {
      const status = context.get("branch").headVersion.status;
      return status === "coding";
    },
  })
  .step(finalizingStep, {
    condition: (context) => {
      const status = context.get("branch").headVersion.status;
      return status === "finalizing";
    },
  });

export async function recoverWorkflow() {
  Logger.info("Recovering workflow");

  let projectsList: Array<
    typeof projects.$inferSelect & {
      integrations?: Array<{
        integrationTemplate: {
          category: unknown;
        };
      }>;
    }
  > = [];

  if (isLocalMode()) {
    // In local mode, recover projects based on IDs saved in metadata file
    const activeProjectIds = getActiveProjectIds();

    if (activeProjectIds.length === 0) {
      Logger.info("No active projects found in metadata file");
      return;
    }

    // Query projects by IDs from metadata file
    const projectsFromMetadata = await db.query.projects.findMany({
      where: inArray(projects.id, activeProjectIds),
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

    projectsList = projectsFromMetadata;
  } else {
    // In cloud mode, each machine handles one project via PROJECT_ID
    if (!process.env.PROJECT_ID) {
      Logger.warn("PROJECT_ID not set in cloud mode");
      return;
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, process.env.PROJECT_ID),
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
    if (project) {
      projectsList = [project];
    }
  }

  if (projectsList.length === 0) {
    return;
  }

  for (const project of projectsList) {
    const installedCategories = await getInstalledCategories(project.id);

    const user = await db.query.users.findFirst({
      where: eq(users.id, project.userId),
    });

    if (!user) {
      Logger.warn(`User not found for project ${project.id}`);
      continue;
    }

    const versionsList = await db.query.versions.findMany({
      where: and(
        eq(versions.projectId, project.id),
        inArray(versions.status, [
          "coding",
          "finalizing",
          "completed",
          "failed",
        ]),
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
}
