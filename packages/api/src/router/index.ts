import { createTRPCRouter } from "../init";
import { canvasNodeRouter } from "./canvas-node";
import { chatsRouter } from "./chats";
import { declarationsRouter } from "./declarations";
import { dependenciesRouter } from "./dependencies";
import { environmentVariablesRouter } from "./environment-variables";
import { integrationTemplatesRouter } from "./integration-templates";
import { integrationsRouter } from "./integrations";
import { projectsRouter } from "./projects";
import { themesRouter } from "./themes";
import { versionRouter } from "./versions";

export const appRouter = createTRPCRouter({
  projects: projectsRouter,
  chats: chatsRouter,
  environmentVariables: environmentVariablesRouter,
  dependencies: dependenciesRouter,
  declarations: declarationsRouter,
  versions: versionRouter,
  canvasNodes: canvasNodeRouter,
  integrations: integrationsRouter,
  integrationTemplates: integrationTemplatesRouter,
  themes: themesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
