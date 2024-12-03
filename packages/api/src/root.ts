import { conversationsRouter } from "./router/conversations";
import { dependenciesRouter } from "./router/dependencies";
import { engineRouter } from "./router/engine";
import { environmentVariablesRouter } from "./router/environment-variables";
import { flowsRouter } from "./router/flows";
import { integrationsRouter } from "./router/integrations";
import { primitivesRouter } from "./router/primitives";
import { resourcesRouter } from "./router/resources";
import { workspacesRouter } from "./router/workspaces";

import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  primitives: primitivesRouter,
  dependencies: dependenciesRouter,
  resources: resourcesRouter,
  workspaces: workspacesRouter,
  flows: flowsRouter,
  engine: engineRouter,
  conversations: conversationsRouter,
  integrations: integrationsRouter,
  environmentVariables: environmentVariablesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
