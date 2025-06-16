import { publicProcedure } from "@/orpc";
import type { Route } from "@orpc/server";

const openAPI = {
  method: "GET",
  tags: ["Health"],
  path: "/health",
  successStatus: 200,
  description: "Health check",
  summary: "Health check",
} satisfies Route;

export default publicProcedure.route(openAPI).handler(async () => {
  return { ok: true };
});
