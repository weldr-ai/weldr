import { conversationsRouter } from "./router/conversations";
import { edgesRouter } from "./router/edges";
import { engineRouter } from "./router/engine";
import { environmentVariablesRouter } from "./router/environment-variables";
import { flowsRouter } from "./router/flows";
import { funcsRouter } from "./router/funcs";
import { integrationsRouter } from "./router/integrations";
import { resourcesRouter } from "./router/resources";
import { testRunsRouter } from "./router/test-runs";
import { workspacesRouter } from "./router/workspaces";

import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  funcs: funcsRouter,
  edges: edgesRouter,
  resources: resourcesRouter,
  workspaces: workspacesRouter,
  flows: flowsRouter,
  engine: engineRouter,
  conversations: conversationsRouter,
  integrations: integrationsRouter,
  environmentVariables: environmentVariablesRouter,
  testRuns: testRunsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
