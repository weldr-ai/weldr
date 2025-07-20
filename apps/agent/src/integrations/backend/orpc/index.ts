import type {
  IntegrationPackageSets,
  IntegrationScriptSets,
} from "@/integrations/types";
import { defineIntegration } from "@/integrations/utils/integration-core";

export const orpcIntegration = await defineIntegration({
  category: "backend",
  key: "orpc",
  name: "oRPC",
  description:
    "End-to-end type-safe API framework with built-in OpenAPI support for building robust, contract-first APIs.",
  version: "1.0.0",
  allowMultiple: false,
  variables: null,
  options: null,
  dependencies: null,
  scripts: async (context) => {
    const project = context.get("project");
    const hasFrontend = project.config.has("frontend");

    if (hasFrontend) {
      return [];
    }

    const scripts: IntegrationScriptSets = [
      {
        target: "root",
        scripts: {
          dev: "turbo dev",
          build: "turbo build",
          start: "turbo start",
        },
      },
    ];

    return scripts;
  },
  packages: async (context) => {
    const project = context.get("project");
    const hasFrontend = project.config.has("frontend");

    const packages: IntegrationPackageSets = [
      {
        target: "server",
        runtime: {
          "@orpc/json-schema": "^1.7.2",
          "@orpc/openapi": "^1.7.2",
          "@orpc/server": "^1.7.2",
          "@orpc/zod": "^1.7.2",
          nanoid: "^5.1.5",
          pino: "^9.7.0",
          "pino-http": "^10.5.0",
          zod: "^4.0.5",
        },
        development: {
          "@types/node": "^24.0.14",
          "dotenv-cli": "^8.0.0",
          "pino-pretty": "^13.0.0",
          tsdown: "^0.12.9",
          tsx: "^4.20.3",
        },
      },
    ];

    if (hasFrontend) {
      packages.push({
        target: "web",
        runtime: {
          "@orpc/client": "^1.7.4",
          "@orpc/tanstack-query": "^1.7.4",
        },
        development: {},
      });
    }

    return packages;
  },
});
