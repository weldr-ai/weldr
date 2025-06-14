import { db, eq } from "@weldr/db";
import { projects } from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
import { nanoid } from "@weldr/shared/nanoid";
import { projectConfigSchema } from "@weldr/shared/validators/projects";
import { tool } from "ai";
import { z } from "zod";

export const initProjectTool = tool({
  description: "Initialize a new project.",
  parameters: z.object({
    name: z.string().describe("The name of the project."),
    config: projectConfigSchema,
  }),
});

export const upgradeToFullStackTool = tool({
  description: "Upgrade the project to a full-stack app.",
  parameters: z.object({}),
});

export const executeInitProjectTool = async ({
  projectId,
  machineId,
  args,
}: {
  projectId: string;
  machineId: string;
  args: z.infer<typeof initProjectTool.parameters>;
}) => {
  const app =
    args.config.server && args.config.client
      ? "full-stack"
      : args.config.server
        ? "server"
        : "web";

  const { exitCode, stderr, success } = await Fly.machine.command({
    type: "job",
    projectId,
    machineId,
    command: `bash /opt/weldr/scripts/init-project.sh ${app}`,
    jobId: `init-project-${projectId}-${nanoid()}`,
  });

  if (exitCode !== 0 || !success) {
    console.error(
      `[initProjectTool:${projectId}] Failed to initialize project: ${stderr || "Unknown error"}`,
    );
    throw new Error(
      `[initProjectTool:${projectId}] Failed to initialize project: ${stderr || "Unknown error"}`,
    );
  }

  await db
    .update(projects)
    .set({
      name: args.name,
      config: args.config,
      initiatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  return args.config;
};

export const executeUpgradeToFullStackTool = async ({
  project,
  machineId,
}: {
  project: typeof projects.$inferSelect;
  machineId: string;
}) => {
  if (project.config?.server && !project.config?.client) {
    const { exitCode, stderr, success } = await Fly.machine.command({
      type: "job",
      projectId: project.id,
      machineId,
      command: "bash /opt/weldr/scripts/update-project.sh web",
      jobId: `update-project-${project.id}-${nanoid()}`,
    });

    if (exitCode !== 0 || !success) {
      console.error(
        `[upgradeToFullStackTool:${project.id}] Failed to upgrade project to full-stack: ${stderr || "Unknown error"}`,
      );
      throw new Error(
        `[upgradeToFullStackTool:${project.id}] Failed to upgrade project to full-stack: ${stderr || "Unknown error"}`,
      );
    }
  }

  if (project.config?.client && !project.config?.server) {
    const { exitCode, stderr, success } = await Fly.machine.command({
      type: "job",
      projectId: project.id,
      machineId,
      command: "bash /opt/weldr/scripts/update-project.sh server",
      jobId: `update-project-${project.id}-${nanoid()}`,
    });

    if (exitCode !== 0 || !success) {
      console.error(
        `[upgradeToFullStackTool:${project.id}] Failed to upgrade project to full-stack: ${stderr || "Unknown error"}`,
      );
      throw new Error(
        `[upgradeToFullStackTool:${project.id}] Failed to upgrade project to full-stack: ${stderr || "Unknown error"}`,
      );
    }
  }

  await db
    .update(projects)
    .set({ config: { server: true, client: true } })
    .where(eq(projects.id, project.id));

  return { server: true, client: true };
};
