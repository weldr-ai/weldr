import { defineIntegration } from "@/integrations/utils/integration-core";

export const betterAuthIntegration = await defineIntegration({
  category: "authentication",
  key: "better-auth",
  name: "Better-Auth",
  description:
    "Modern, self-hosted authentication solution with complete user management, social logins, and session handling.",
  version: "1.0.0",
  allowMultiple: false,
  options: {
    socialProviders: ["github", "google", "microsoft"],
    plugins: ["admin", "oAuthProxy", "openAPI", "organization", "stripe"],
    emailVerification: true,
    emailAndPassword: true,
    stripeIntegration: true,
  },
  variables: [
    {
      name: "BETTER_AUTH_SECRET",
      source: "system",
      isRequired: true,
    },
  ],
  dependencies: ["backend", "database"],
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
    "full-stack": {
      server: "server",
      web: "web",
    },
  },
});
