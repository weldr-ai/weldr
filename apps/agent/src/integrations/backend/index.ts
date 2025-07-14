import { integrationRegistry } from "../registry";
import type { IntegrationDefinition } from "../types";
import {
  combineResults,
  fileExists,
  installPackages,
  runBunScript,
} from "../utils";

const backendIntegration: IntegrationDefinition = {
  key: "backend",
  name: "Backend Integration",
  description: "Adds Node.js backend capabilities with API routes",

  preInstall: async () => {
    return {
      success: true,
      message: "Backend integration pre-installation checks passed",
    };
  },

  installPackages: async () => {
    const prodPackages = {
      "@hono/node-server": "^1.15.0",
      "@hono/zod-openapi": "^0.19.9",
      "@orpc/openapi": "^1.6.6",
      "@orpc/zod": "^1.6.6",
      hono: "^4.8.4",
      "hono-pino": "^0.9.1",
    };

    const results = await installPackages(prodPackages, false);

    return results;
  },

  postInstall: async () => {
    const setupResults = [];

    // Check if we need to generate database schema
    const hasDrizzleConfig = await fileExists("drizzle.config.ts");
    if (hasDrizzleConfig) {
      const dbGenResult = await runBunScript("db:generate");
      setupResults.push(dbGenResult);
    }

    // You could add more setup steps like:
    // - Creating JWT secrets
    // - Setting up environment variables
    // - Running database migrations
    // - Creating default admin user

    return combineResults(setupResults);
  },

  validate: async () => {
    const hasServerDir = await fileExists("server");
    const hasApiRoutes = await fileExists("server/api");

    if (!hasServerDir || !hasApiRoutes) {
      return {
        success: false,
        message: "Backend integration validation failed",
        errors: [
          ...(hasServerDir ? [] : ["server directory not found"]),
          ...(hasApiRoutes ? [] : ["server/api directory not found"]),
        ],
      };
    }

    return {
      success: true,
      message: "Backend integration validation passed",
    };
  },
};

// Register the integration
integrationRegistry.register(backendIntegration);
