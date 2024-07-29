import { authRouter } from "./router/auth";
import { deployerRouter } from "./router/deployer";
import { edgesRouter } from "./router/edges";
import { flowsRouter } from "./router/flows";
import { helloRouter } from "./router/hello";
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
  deployer: deployerRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
