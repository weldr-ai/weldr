import type { Route } from "@orpc/server";
import { base } from "@server/orpc/utils";

const openAPI = {
  method: "GET",
  tags: ["Health"],
  path: "/health",
  successStatus: 200,
  description: "Health check",
  summary: "Health check",
} satisfies Route;

export default base.route(openAPI).handler(async () => {
  return { ok: true };
});
