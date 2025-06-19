import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { configureOpenAPI, createRouter } from "./lib/hono-utils";
import { loggerMiddleware } from "./middlewares/logger";
import { routes } from "./routes";
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

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
