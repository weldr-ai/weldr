import type { Dependency, Module } from "@/index.ts";
import {
  createLibraries,
  createTemporaryDirectory,
  exec,
  installDependencies,
  writeTestEnvFile,
} from "@/lib/utils";
import superjson from "superjson";

interface MockRequestOptions {
  method?: string;
  url?: string;
  query?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}

interface ExecuteEndpointOptions {
  request: MockRequestOptions;
  code: string;
  modules?: Module[];
  dependencies?: Dependency[];
  environmentVariablesMap?: Record<string, string>;
  testEnv?: { key: string; value: string }[];
}

async function createIndexFile({
  tempDir,
  code,
  request,
}: {
  tempDir: string;
  code: string;
  request: MockRequestOptions;
}) {}

export async function executeEndpoint({
  request,
  code,
  modules,
  dependencies,
  environmentVariablesMap,
  testEnv,
}: ExecuteEndpointOptions) {
  console.log("[executeEndpoint] Starting code execution process...");

  // Create temporary directory
  const tempDir = await createTemporaryDirectory();

  // Create index.ts file
  await createIndexFile({ tempDir, code, request });

  // Install dependencies
  if (dependencies && dependencies.length > 0) {
    console.log("[executeEndpoint] Installing additional dependencies...");
    await installDependencies({ tempDir, dependencies });
  }

  // Create utilities
  if (modules && modules.length > 0) {
    console.log("[executeEndpoint] Setting up utilities...");
    await createLibraries({ tempDir, modules, environmentVariablesMap });
  }

  // Write test environment variables
  if (
    testEnv &&
    Object.keys(testEnv).length > 0 &&
    process.env.NODE_ENV === "development"
  ) {
    console.log("[executeEndpoint] Writing environment variables...");
    await writeTestEnvFile({ tempDir, testEnv });
  }

  try {
    console.log("[executeEndpoint] Executing user code...");
    const { stdout, stderr } = await exec(`cd ${tempDir} && bun index.ts`);
    const jsonStartIndex = stdout.indexOf('{"json":');
    const jsonEndIndex = stdout.lastIndexOf("}") + 1;
    const jsonOutput = stdout.slice(jsonStartIndex, jsonEndIndex);
    console.log("[executeEndpoint] Code execution completed");
    if (stderr && !jsonOutput) {
      console.error(`[executeEndpoint] Error during execution: ${stderr}`);
      return;
    }
    console.log("[executeEndpoint] Parsing execution output");
    const parsedOutput = superjson.parse(jsonOutput);
    console.log("[executeEndpoint] Execution completed successfully");
    return parsedOutput;
  } catch (error) {
    console.error(`[executeEndpoint] Execution failed: ${error}`);
  }
}
