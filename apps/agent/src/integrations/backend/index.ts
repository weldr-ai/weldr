import { defineIntegration } from "../utils/integration-core";
import { runBunScript } from "../utils/packages";

export const backendIntegration = await defineIntegration({
  key: "backend",
  name: "Backend Integration",
  description: "Hono backend integration with oRPC and OpenAPI",
  packages: {
    add: {
      runtime: {
        "@hono/node-server": "^1.15.0",
        "@hono/zod-openapi": "^0.19.9",
        "@orpc/openapi": "^1.6.6",
        "@orpc/zod": "^1.6.6",
        hono: "^4.8.4",
        "hono-pino": "^0.9.1",
      },
    },
  },
  postInstall: async () => {
    const dbGenResult = await runBunScript("db:generate");
    return dbGenResult;
  },
});
