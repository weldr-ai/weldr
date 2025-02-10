import { chatsRouter } from "./router/chats";
import { dependenciesRouter } from "./router/dependencies";
import { endpointsRouter } from "./router/endpoints";
import { engineRouter } from "./router/engine";
import { environmentVariablesRouter } from "./router/environment-variables";
import { funcsRouter } from "./router/funcs";
import { integrationsRouter } from "./router/integrations";
import { projectsRouter } from "./router/projects";
import { resourcesRouter } from "./router/resources";
import { versionsRouter } from "./router/versions";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  funcs: funcsRouter,
  resources: resourcesRouter,
  projects: projectsRouter,
  endpoints: endpointsRouter,
  versions: versionsRouter,
  engine: engineRouter,
  chats: chatsRouter,
  integrations: integrationsRouter,
  environmentVariables: environmentVariablesRouter,
  dependencies: dependenciesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
