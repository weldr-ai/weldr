import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import { Logger } from "@weldr/shared/logger";
import { recoverSemanticDataJobs } from "./ai/utils/semantic-data-jobs";
import { closeRedisConnections } from "./lib/stream-utils";
import { configureOpenAPI, createRouter } from "./lib/utils";
import { loggerMiddleware } from "./middlewares/logger";
import { routes } from "./routes";
import { recoverWorkflow } from "./workflow";
import { WorkflowContext } from "./workflow/context";

const app = createRouter();

app
  .use(requestId())
  .use(loggerMiddleware())
  .use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") ?? "http://localhost:3000",
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Type", "Authorization"],
      maxAge: 600,
      credentials: true,
    }),
  );

configureOpenAPI(app);

app.use(async (c, next) => {
  const workflowContext = new WorkflowContext();
  c.set("workflowContext", workflowContext);
  await next();
});

for (const route of routes) {
  app.route("/", route);
}

app.use("*", async (c) => {
  return c.json(
    {
      message: "Not found",
    },
    404,
  );
});

app.onError((err, c) => {
  console.error(err);
  return c.json(
    {
      message: "Internal server error",
    },
    500,
  );
});

const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 8080;

// Graceful shutdown
process.on("SIGINT", async () => {
  Logger.info("Received SIGINT, shutting down gracefully...");
  await closeRedisConnections();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  Logger.info("Received SIGTERM, shutting down gracefully...");
  await closeRedisConnections();
  process.exit(0);
});

serve(
  {
    fetch: app.fetch,
    port,
  },
  async (info) => {
    Logger.info(`Server is running on http://localhost:${info.port}`);
    await recoverWorkflow();
    await recoverSemanticDataJobs();
  },
);
