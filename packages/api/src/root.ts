import { canvasNodeRouter } from "./router/canvas-node";
import { chatsRouter } from "./router/chats";
import { declarationsRouter } from "./router/declarations";
import { dependenciesRouter } from "./router/dependencies";
import { environmentVariablesRouter } from "./router/environment-variables";
import { projectsRouter } from "./router/projects";
import { versionRouter } from "./router/versionts";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  projects: projectsRouter,
  chats: chatsRouter,
  environmentVariables: environmentVariablesRouter,
  dependencies: dependenciesRouter,
  declarations: declarationsRouter,
  versions: versionRouter,
  canvasNodes: canvasNodeRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
