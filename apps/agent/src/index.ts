import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { initializeSemanticEnrichment, shutdownSemanticEnrichment } from "./ai/services/semantic-enrichment";
import { Logger } from "./lib/logger";
import { configureOpenAPI, createRouter } from "./lib/utils";
import { loggerMiddleware } from "./middlewares/logger";
import { routes } from "./routes";
import { workflow } from "./workflow";
import { WorkflowContext } from "./workflow/context";

const app = createRouter();

app
  .use(requestId())
  .use(loggerMiddleware())
  .use(
    cors({
      origin: "http://localhost:3000",
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

app.post("/listen", async (c) => {
  return c.json({
    message: "Hello World",
  });
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

// Handle graceful shutdown
process.on("SIGINT", async () => {
  Logger.info("Server shutting down gracefully...", { tags: ["shutdown"] });

  // Shutdown semantic enrichment
  await shutdownSemanticEnrichment();

  if (process.env.PROJECT_ID) {
    await workflow.markActiveVersionWorkflowAsFailed(process.env.PROJECT_ID);
    Logger.info("Marked active workflow as failed due to shutdown", {
      tags: ["shutdown"],
    });
  }

  process.exit(0);
});

process.on("SIGTERM", async () => {
  Logger.info("Server shutting down gracefully...", { tags: ["shutdown"] });

  // Shutdown semantic enrichment
  await shutdownSemanticEnrichment();

  if (process.env.PROJECT_ID) {
    await workflow.markActiveVersionWorkflowAsFailed(process.env.PROJECT_ID);
    Logger.info("Marked active workflow as failed due to shutdown", {
      tags: ["shutdown"],
    });
  }

  process.exit(0);
});

// Recovery on startup
async function recoverWorkflows() {
  if (process.env.PROJECT_ID) {
    await workflow.recoverActiveVersionWorkflow(process.env.PROJECT_ID);
    Logger.info("Recovered crashed workflows on startup", {
      tags: ["startup"],
    });
  }
}

// Initialize semantic enrichment
async function initializeServices() {
  try {
    await initializeSemanticEnrichment();
    Logger.info("Semantic enrichment initialized", { tags: ["startup"] });
  } catch (error) {
    Logger.error("Failed to initialize semantic enrichment", {
      tags: ["startup"],
      extra: { error: error instanceof Error ? error.message : error },
    });
  }
}

serve(
  {
    fetch: app.fetch,
    port,
  },
  async (info) => {
    Logger.info(`Server is running on http://localhost:${info.port}`, {
      tags: ["server"],
    });

    // Initialize services
    await initializeServices();

    // Recover any crashed workflows
    await recoverWorkflows();
  },
);
