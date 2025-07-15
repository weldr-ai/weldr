import { integrationRegistry } from "./registry";

// Export main registry and types
export { integrationRegistry } from "./registry";
export type {
  IntegrationCallback,
  IntegrationCallbackResult,
  IntegrationDefinition,
} from "./types";

// Export utilities
export {
  createDirectory,
  directoryExists,
  fileExists,
} from "./utils/file-system";
export { combineResults } from "./utils/integration-core";
export { installPackages, runBunScript } from "./utils/packages";

async function main() {
  const postgresqlIntegration = await integrationRegistry.get("postgresql");
  console.log(postgresqlIntegration?.files);
}

main().catch(console.error);
