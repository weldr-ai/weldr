import { getProjectContext } from "@/lib/get-project-context";
import type { AgentRuntimeContext } from "@/mastra";
import { Agent } from "@mastra/core/agent";
import type { RuntimeContext } from "@mastra/core/runtime-context";
import { registry } from "../../lib/registry";
import { prompts } from "../prompts";
import { deleteFilesTool, listFilesTool, readFilesTool } from "../tools/files";
import { installPackagesTool, removePackagesTool } from "../tools/packages";

export const coderAgent = new Agent({
  name: "Coder",
  instructions: async ({
    runtimeContext,
  }: { runtimeContext: RuntimeContext<AgentRuntimeContext> }) => {
    const project = runtimeContext.get("project");
    const projectContext = await getProjectContext(project.id);
    return prompts.generalCoder(projectContext);
  },
  model: registry.languageModel("anthropic:claude-3-5-sonnet-latest"),
  tools: {
    listFiles: listFilesTool,
    readFiles: readFilesTool,
    deleteFiles: deleteFilesTool,
    installPackages: installPackagesTool,
    removePackages: removePackagesTool,
  },
});
