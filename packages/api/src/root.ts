import { conversationsRouter } from "./router/conversations";
import { dependenciesRouter } from "./router/dependencies";
import { endpointsRouter } from "./router/endpoints";
import { engineRouter } from "./router/engine";
import { environmentVariablesRouter } from "./router/environment-variables";
import { funcsRouter } from "./router/funcs";
import { integrationsRouter } from "./router/integrations";
import { projectsRouter } from "./router/projects";
import { resourcesRouter } from "./router/resources";
import { testRunsRouter } from "./router/test-runs";

import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  funcs: funcsRouter,
  dependencies: dependenciesRouter,
  resources: resourcesRouter,
  projects: projectsRouter,
  endpoints: endpointsRouter,
  engine: engineRouter,
  conversations: conversationsRouter,
  integrations: integrationsRouter,
  environmentVariables: environmentVariablesRouter,
  testRuns: testRunsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
