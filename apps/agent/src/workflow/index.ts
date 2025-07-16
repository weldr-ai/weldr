import { and, db, eq, or } from "@weldr/db";
import { projects, users, versions } from "@weldr/db/schema";
import { WorkflowContext } from "./context";
import { createStep, createWorkflow } from "./engine";
import { codeStep } from "./steps/code";
import { deployStep } from "./steps/deploy";
import { planStep } from "./steps/plan";

const isDev = process.env.NODE_ENV === "development";

export const workflow = createWorkflow({
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
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
            await db
              .update(versions)
              .set({ status: "completed" })
              .where(eq(versions.id, version.id));
          },
        })
      : deployStep,
  );

export async function recoverWorkflow() {
  const project = await db.query.projects.findFirst({
    // biome-ignore lint/style/noNonNullAssertion: reason
    where: eq(projects.id, process.env.PROJECT_ID!),
    with: {
      integrations: {
        with: {
          integrationTemplate: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const integrations = project.integrations.reduce(
    (acc, integration) => {
      if (integration.integrationTemplate.category === "backend") {
        acc.push("backend");
      }
      if (integration.integrationTemplate.category === "frontend") {
        acc.push("frontend");
      }
      return acc;
    },
    [] as ("frontend" | "backend")[],
  );

  const projectType =
    integrations.includes("backend") && integrations.includes("frontend")
      ? "full-stack"
      : integrations.includes("backend")
        ? "standalone-backend"
        : integrations.includes("frontend")
          ? "standalone-frontend"
          : null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, project.userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  const version = await db.query.versions.findFirst({
    where: and(
      eq(versions.projectId, project.id),
      or(
        eq(versions.status, "planning"),
        eq(versions.status, "coding"),
        eq(versions.status, "deploying"),
      ),
    ),
  });

  if (!version) {
    return;
  }

  const context = new WorkflowContext();
  context.set("project", { ...project, type: projectType });
  context.set("version", version);
  context.set("user", user);
  context.set("isXML", true);

  await workflow.execute({ context });
}
