// Export main registry and types
export { integrationRegistry } from "./registry";
export type {
  IntegrationCallback,
  IntegrationCallbackResult,
  IntegrationContext,
  IntegrationDefinition,
} from "./types";

// Export utilities
export {
  combineResults,
  createDirectory,
  directoryExists,
  fileExists,
  installPackages,
  runBunScript,
} from "./utils";

// The registry will automatically import all integrations
// when this module is loaded
