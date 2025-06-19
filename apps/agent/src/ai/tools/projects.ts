import { SCRIPTS_DIR } from "@/lib/constants";
import { execute } from "@/lib/exec";
import { db, eq } from "@weldr/db";
import { projects } from "@weldr/db/schema";
import { projectConfigSchema } from "@weldr/shared/validators/projects";
import { z } from "zod";
import { createTool } from "../utils/create-tool";

const initProjectInputSchema = z.object({
  title: z.string().describe("Short title for the project."),
  config: projectConfigSchema,
});

const initProjectOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    config: projectConfigSchema,
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export const initProjectTool = createTool({
  description:
    "Initialize a new project. This DOES NOT code the project. It only setup the boilerplate code.",
  inputSchema: initProjectInputSchema,
  outputSchema: initProjectOutputSchema,
  execute: async ({ input, context }) => {
    const project = context.get("project");

    if (project.initiatedAt) {
      console.log(
        `[initProjectTool:${project.id}] Project already initialized, returning existing config`,
      );
      return { success: true, config: project.config || input.config };
    }

    const app =
      input.config.server && input.config.client
        ? "full-stack"
        : input.config.server
          ? "server"
          : "web";

    const { exitCode, stderr, success } = await execute("bash", [
      `${SCRIPTS_DIR}/init-project.sh`,
      app,
    ]);

    if (exitCode !== 0 || !success) {
      const error = `[initProjectTool:${project.id}] Failed to initialize project: ${
        stderr || "Unknown error"
      }`;
      console.error(error);
      return { success: false, error };
    }

    const [updatedProject] = await db
      .update(projects)
      .set({
        title: input.title,
        config: input.config,
        initiatedAt: new Date(),
      })
      .where(eq(projects.id, project.id))
      .returning();

    if (!updatedProject) {
      const error = `[initProjectTool:${
        project.id
      }] Failed to initialize project: Project not found`;
      return { success: false, error };
    }

    context.set("project", updatedProject);

    return { success: true, config: input.config };
  },
});

const upgradeToFullStackInputSchema = z.object({});

const upgradeToFullStackOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    server: z.boolean(),
    client: z.boolean(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export const upgradeToFullStackTool = createTool({
  description:
    "Upgrade the project to a full-stack app. This DOES NOT code the project. It only setup the boilerplate code.",
  inputSchema: upgradeToFullStackInputSchema,
  outputSchema: upgradeToFullStackOutputSchema,
  execute: async ({ context }) => {
    const project = context.get("project");

    if (project.config?.server && project.config?.client) {
      console.log(
        `[upgradeToFullStackTool:${project.id}] Project already full-stack, returning existing config`,
      );
      return { success: true, server: true, client: true };
    }

    if (project.config?.server && !project.config?.client) {
      const { exitCode, stderr, success } = await execute("bash", [
        `${SCRIPTS_DIR}/update-project.sh`,
        "web",
      ]);

      if (exitCode !== 0 || !success) {
        const error = `[upgradeToFullStackTool:${
          project.id
        }] Failed to upgrade project to full-stack: ${stderr || "Unknown error"}`;
        console.error(error);
        return { success: false, error };
      }
    }

    if (project.config?.client && !project.config?.server) {
      const { exitCode, stderr, success } = await execute("bash", [
        `${SCRIPTS_DIR}/update-project.sh`,
        "server",
      ]);

      if (exitCode !== 0 || !success) {
        const error = `[upgradeToFullStackTool:${
          project.id
        }] Failed to upgrade project to full-stack: ${stderr || "Unknown error"}`;
        console.error(error);
        return { success: false, error };
      }
    }

    const [updatedProject] = await db
      .update(projects)
      .set({ config: { server: true, client: true } })
      .where(eq(projects.id, project.id))
      .returning();

    if (!updatedProject) {
      const error = `[upgradeToFullStackTool:${
        project.id
      }] Failed to upgrade project to full-stack: Project not found`;
      return { success: false, error };
    }

    context.set("project", updatedProject);

    return { success: true, server: true, client: true };
  },
});
