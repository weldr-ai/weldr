import { chatsRouter } from "./router/chats";
import { dependenciesRouter } from "./router/dependencies";
import { environmentVariablesRouter } from "./router/environment-variables";
import { projectsRouter } from "./router/projects";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  projects: projectsRouter,
  chats: chatsRouter,
  environmentVariables: environmentVariablesRouter,
  dependencies: dependenciesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
