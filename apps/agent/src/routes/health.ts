import { createRouter } from "@/lib/utils";
import { createRoute } from "@hono/zod-openapi";

const route = createRoute({
  method: "get",
  path: "/health",
  summary: "Health check",
  description: "Check if the server is running",
  tags: ["Health"],
  responses: {
    200: {
      description: "Server is running",
    },
  },
});

const router = createRouter();

router.openapi(route, async (c) => {
  return c.json({
    status: "ok",
  });
});

export default router;
