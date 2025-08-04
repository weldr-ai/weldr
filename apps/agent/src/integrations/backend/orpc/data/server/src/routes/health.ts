import type { Route } from "@orpc/server";
import z from "zod";

import { base } from "@repo/server/lib/utils";

const openAPI = {
  method: "GET",
  tags: ["Health"],
  path: "/health",
  successStatus: 200,
  description: "Health check",
  summary: "Health check",
} satisfies Route;

const outputSchema = z.object({
  ok: z.boolean(),
});

export default base
  .route(openAPI)
  .output(outputSchema)
  .handler(async () => {
    return { ok: true };
  });
