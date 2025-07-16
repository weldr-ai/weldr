import { defineIntegration } from "@/integrations/utils/integration-core";

export const honoIntegration = await defineIntegration({
  category: "backend",
  key: "hono",
  name: "Hono",
  description:
    "Fast, lightweight web framework for building APIs and applications with built-in middleware, type safety, and multi-runtime support.",
  version: "1.0.0",
  allowMultiple: false,
  variables: null,
  options: null,
  dependencies: null,
  scripts: {
    dev: "tsx watch src/index.ts",
    build:
      "esbuild src/index.ts --platform=node --packages=external --bundle --minify --format=esm --outdir=dist",
    start: "node dist/index.js",
    typecheck: "tsc --noEmit",
    check: "biome check --diagnostic-level=warn",
    "check:fix": "biome check --diagnostic-level=warn --write",
  },
  packages: {
    add: {
      runtime: {
        "@hono/node-server": "^1.15.0",
        "@hono/zod-openapi": "^0.19.9",
        "@orpc/openapi": "^1.6.6",
        "@orpc/zod": "^1.6.6",
        hono: "^4.8.4",
        "hono-pino": "^0.9.1",
        zod: "^3.25.49",
      },
      development: {
        "@biomejs/biome": "1.9.4",
        "@types/node": "^22.15.30",
        esbuild: "^0.25.5",
        tsx: "^4.20.0",
        typescript: "^5.8.3",
      },
    },
  },
  dirMap: {
    "standalone-backend": {
      server: "src",
      "config/shared/*": ".",
      "config/standalone/*": ".",
    },
    "full-stack": {
      server: "server",
      "config/shared/*": ".",
      "config/full-stack/*": ".",
    },
  },
});
