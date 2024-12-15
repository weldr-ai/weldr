import { conversationsRouter } from "./router/conversations";
import { engineRouter } from "./router/engine";
import { environmentVariablesRouter } from "./router/environment-variables";
import { funcDependenciesRouter } from "./router/func-dependencies";
import { funcInternalGraphRouter } from "./router/func-internal-graph";
import { funcsRouter } from "./router/funcs";
import { integrationsRouter } from "./router/integrations";
import { modulesRouter } from "./router/modules";
import { resourcesRouter } from "./router/resources";
import { testRunsRouter } from "./router/test-runs";
import { workspacesRouter } from "./router/workspaces";

import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  funcs: funcsRouter,
  funcDependencies: funcDependenciesRouter,
  resources: resourcesRouter,
  workspaces: workspacesRouter,
  modules: modulesRouter,
  engine: engineRouter,
  conversations: conversationsRouter,
  integrations: integrationsRouter,
  environmentVariables: environmentVariablesRouter,
  testRuns: testRunsRouter,
  funcInternalGraph: funcInternalGraphRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
