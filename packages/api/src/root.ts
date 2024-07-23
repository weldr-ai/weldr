import { authRouter } from "./router/auth";
import { helloRouter } from "./router/hello";
import { primitivesRouter } from "./router/primitives";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  hello: helloRouter,
  primitives: primitivesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
