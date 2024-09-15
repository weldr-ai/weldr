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
    "@specly/api",
    "@specly/auth",
    "@specly/db",
    "@specly/ui",
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },
};

export default config;
