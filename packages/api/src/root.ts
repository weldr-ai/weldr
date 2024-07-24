import { authRouter } from "./router/auth";
import { edgesRouter } from "./router/edges";
import { helloRouter } from "./router/hello";
import { primitivesRouter } from "./router/primitives";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  hello: helloRouter,
  primitives: primitivesRouter,
  edges: edgesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
