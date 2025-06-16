import { getProjectContext } from "@/lib/get-project-context";
import { registry } from "@/lib/registry";
import type { AgentRuntimeContext } from "@/mastra";
import { planner } from "@/mastra/prompts/planner";
import { Agent, createTool } from "@mastra/core";
import type { RuntimeContext } from "@mastra/core/runtime-context";
import { db } from "@weldr/db";
import { z } from "zod";
import { setupIntegrationsTool } from "../tools/integrations";
import { initProjectTool, upgradeToFullStackTool } from "../tools/projects";

export const plannerAgent = new Agent({
  name: "planner",
  description: "A planner agent",
  model: registry.languageModel("google:gemini-2.0-flash"),
  instructions: async ({
    runtimeContext,
  }: { runtimeContext: RuntimeContext<AgentRuntimeContext> }) => {
    const project = runtimeContext.get("project");

    const allIntegrationTemplates =
      await db.query.integrationTemplates.findMany();

    const integrationTemplatesList = allIntegrationTemplates
      .map(
        (integrationTemplate) =>
          `- ${integrationTemplate.name} (key: ${integrationTemplate.key}):
Type: ${integrationTemplate.type}
Description: ${integrationTemplate.description}`,
      )
      .join("\n\n");

    const projectContext = await getProjectContext(project.id);
    return planner(projectContext, integrationTemplatesList);
  },
  tools: {
    initProject: initProjectTool,
    upgradeToFullStack: upgradeToFullStackTool,
    setupIntegrations: setupIntegrationsTool,
    startCoding: createTool({
      id: "startCoding",
      description: "Start coding a new feature",
      inputSchema: z.object({
        commitMessage: z.string(),
        description: z.string(),
      }),
    }),
  },
});
