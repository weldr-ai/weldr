import { defineIntegration } from "../utils/integration-core";

export const betterAuthIntegration = await defineIntegration({
  key: "better-auth",
  name: "Better Auth",
  description: "Better Auth integration",
  packages: {
    add: {
      runtime: {
        "better-auth": "^1.2.12",
      },
    },
  },
  dirMap: {
    "standalone-backend": {
      server: "src",
    },
  },
});
