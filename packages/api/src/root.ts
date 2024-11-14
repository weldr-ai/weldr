import { authRouter } from "./router/auth";
import { conversationsRouter } from "./router/conversations";
import { edgesRouter } from "./router/edges";
import { engineRouter } from "./router/engine";
import { environmentVariablesRouter } from "./router/environment-variables";
import { flowsRouter } from "./router/flows";
import { helloRouter } from "./router/hello";
import { integrationsRouter } from "./router/integrations";
import { primitivesRouter } from "./router/primitives";
import { resourcesRouter } from "./router/resources";
import { workspacesRouter } from "./router/workspaces";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  hello: helloRouter,
  primitives: primitivesRouter,
  edges: edgesRouter,
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
