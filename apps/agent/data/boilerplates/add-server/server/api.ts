import { requestId } from "hono/request-id";
import { configureOpenAPI, createHonoRouter } from "./lib/utils";
import { loggerMiddleware } from "./middlewares/logger";
import { configureORPC } from "./orpc/utils";
import routes from "./routes";

const app = createHonoRouter().basePath("/api");

// Base routes
app.use(requestId()).use(loggerMiddleware());

// ORPC
configureORPC(app);

// Hono routes
for (const route of routes) {
  app.route("/", route);
}

// OpenAPI
configureOpenAPI(app);

// 404
app.use("*", async (c) => {
  return c.json({ error: "Not found" }, 404);
});

// Error
app.onError((err, c) => {
  c.var.logger.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

export default app;
