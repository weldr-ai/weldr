import { SCRIPTS_DIR } from "@/lib/constants";
import { executeShell } from "@/lib/exec";
import type { AgentRuntimeContext } from "@/mastra";
import { createTool } from "@mastra/core";
import type { RuntimeContext } from "@mastra/core/runtime-context";
import { db, eq } from "@weldr/db";
import { projects } from "@weldr/db/schema";
import { projectConfigSchema } from "@weldr/shared/validators/projects";
import { z } from "zod";

const initProjectInputSchema = z.object({
  name: z.string().describe("The name of the project."),
  config: projectConfigSchema,
});

export const initProjectTool = createTool({
  id: "init-project-tool",
  description: "Initialize a new project.",
  inputSchema: initProjectInputSchema,
  outputSchema: z.object({
    config: projectConfigSchema,
  }),
  execute: async ({
    context,
    runtimeContext,
  }: {
    context: z.infer<typeof initProjectInputSchema>;
    runtimeContext: RuntimeContext<AgentRuntimeContext>;
  }) => {
    const project = runtimeContext.get("project");

    const app =
      context.config.server && context.config.client
        ? "full-stack"
        : context.config.server
          ? "server"
          : "web";

    const { exitCode, stderr, success } = await executeShell(
      `bash ${SCRIPTS_DIR}/init-project.sh ${app}`,
    );

    if (exitCode !== 0 || !success) {
      console.error(
        `[initProjectTool:${project.id}] Failed to initialize project: ${stderr || "Unknown error"}`,
      );
      throw new Error(
        `[initProjectTool:${project.id}] Failed to initialize project: ${stderr || "Unknown error"}`,
      );
    }

    await db
      .update(projects)
      .set({
        name: context.name,
        config: context.config,
        initiatedAt: new Date(),
      })
      .where(eq(projects.id, project.id));

    return { config: context.config };
  },
});

export const upgradeToFullStackTool = createTool({
  id: "upgrade-to-full-stack-tool",
  description: "Upgrade the project to a full-stack app.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    server: z.boolean(),
    client: z.boolean(),
  }),
  execute: async ({
    runtimeContext,
  }: {
    runtimeContext: RuntimeContext<AgentRuntimeContext>;
  }) => {
    const project = runtimeContext.get("project");

    if (project.config?.server && !project.config?.client) {
      const { exitCode, stderr, success } = await executeShell(
        `bash ${SCRIPTS_DIR}/update-project.sh web`,
      );

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
      const { exitCode, stderr, success } = await executeShell(
        `bash ${SCRIPTS_DIR}/update-project.sh server`,
      );

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
  },
});
