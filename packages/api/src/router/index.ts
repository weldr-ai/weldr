import { createTRPCRouter } from "../init";
import { chatsRouter } from "./chats";
import { declarationsRouter } from "./declarations";
import { environmentVariablesRouter } from "./environment-variables";
import { integrationTemplatesRouter } from "./integration-templates";
import { integrationsRouter } from "./integrations";
import { nodesRouter } from "./nodes";
import { projectsRouter } from "./projects";
import { themesRouter } from "./themes";
import { versionRouter } from "./versions";

export const appRouter = createTRPCRouter({
  projects: projectsRouter,
  chats: chatsRouter,
  environmentVariables: environmentVariablesRouter,
  declarations: declarationsRouter,
  versions: versionRouter,
  integrations: integrationsRouter,
  integrationTemplates: integrationTemplatesRouter,
  themes: themesRouter,
  nodes: nodesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
