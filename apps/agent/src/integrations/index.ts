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
  combineResults,
  createDirectory,
  directoryExists,
  fileExists,
  installPackages,
  runBunScript,
} from "./utils";

async function main() {
  const postgresqlIntegration = await integrationRegistry.get("postgresql");
  console.log(postgresqlIntegration?.files);
}

main().catch(console.error);
