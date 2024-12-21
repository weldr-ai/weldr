// @ts-check

// import { fileURLToPath } from "node:url";
// import createJiti from "jiti";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
// createJiti(fileURLToPath(import.meta.url))("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@integramind/api",
    "@integramind/auth",
    "@integramind/db",
    "@integramind/ui",
  ],

  images: {
    remotePatterns: [
      {
        hostname: "localhost",
      },
    ],
  },

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },
};

export default config;
