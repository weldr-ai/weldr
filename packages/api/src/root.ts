import { canvasNodeRouter } from "./router/canvas-node";
import { chatsRouter } from "./router/chats";
import { declarationsRouter } from "./router/declarations";
import { dependenciesRouter } from "./router/dependencies";
import { environmentVariablesRouter } from "./router/environment-variables";
import { integrationTemplatesRouter } from "./router/integration-templates";
import { integrationsRouter } from "./router/integrations";
import { projectsRouter } from "./router/projects";
import { themesRouter } from "./router/themes";
import { versionRouter } from "./router/versions";
import { createTRPCRouter } from "./trpc";

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
