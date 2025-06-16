import type { Route } from "@orpc/server";
import { publicProcedure } from "@server/orpc";

const openAPI = {
  method: "GET",
  tags: ["Health"],
  path: "/health",
  successStatus: 200,
  description: "Health check",
  summary: "Health check",
  spec: {
    security: [],
  },
} satisfies Route;

export default publicProcedure.route(openAPI).handler(async () => {
  return { ok: true };
});
