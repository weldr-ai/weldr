import fs from "node:fs/promises";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import superjson from "superjson";
import type { Dependency, Utility } from "../index";
import {
  createLibraries,
  createTemporaryDirectory,
  exec,
  installDependencies,
  writeTestEnvFile,
} from "./utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ExecuteFunctionOptions {
  code: string;
  hasInput: boolean;
  functionName: string;
  functionArgs?: Record<string, unknown>;
  utilities?: Utility[];
  dependencies?: Dependency[];
  environmentVariablesMap?: Record<string, string>;
  testEnv?: { key: string; value: string }[];
}

async function createIndexFile({
  tempDir,
  code,
  hasInput,
  functionName,
  functionArgs,
}: {
  tempDir: string;
  code: string;
  hasInput: boolean;
  functionName: string;
  functionArgs?: Record<string, unknown>;
}) {
  console.log("[generatePackage] Generating Node.js project...");
  console.log(`[generatePackage] Function to execute: ${functionName}`);
  const template = await fs.readFile(
    path.join(__dirname, "templates", "functions", "index.hbs"),
    "utf-8",
  );
  const compiledTemplate = Handlebars.compile(template, { noEscape: true });
  const indexFile = compiledTemplate({
    code,
    functionName,
    functionArgs: functionArgs ? JSON.stringify(functionArgs) : undefined,
    hasInput,
  });
  const tempFile = path.join(tempDir, "index.ts");
  await fs.writeFile(tempFile, indexFile);
  console.log("[generatePackage] Generated index.ts file");
  await fs.copyFile(
    path.join(__dirname, "templates", "functions", "package.json"),
    path.join(tempDir, "package.json"),
  );
  console.log("[generatePackage] Package.json copied successfully");
  console.log("[generatePackage] Node.js project setup complete");
}

export async function executeFunction({
  code,
  functionName,
  functionArgs,
  hasInput,
  utilities,
  dependencies,
  environmentVariablesMap,
  testEnv,
}: ExecuteFunctionOptions) {
  console.log("[executeFunction] Starting function execution process...");

  // Create temporary directory
  const tempDir = await createTemporaryDirectory();

  // Create index.ts file
  await createIndexFile({
    tempDir,
    code,
    functionName,
    functionArgs,
    hasInput,
  });

  // Install dependencies
  if (dependencies && dependencies.length > 0) {
    console.log("[executeFunction] Installing additional dependencies...");
    await installDependencies({ tempDir, dependencies });
  }

  // Create utilities
  if (utilities && utilities.length > 0) {
    console.log("[executeFunction] Setting up utilities...");
    await createLibraries({ tempDir, utilities, environmentVariablesMap });
  }

  // Write test environment variables
  if (
    testEnv &&
    Object.keys(testEnv).length > 0 &&
    process.env.NODE_ENV === "development"
  ) {
    console.log("[executeFunction] Writing environment variables...");
    await writeTestEnvFile({ tempDir, testEnv });
  }

  try {
    console.log("[executeFunction] Executing user code...");
    const { stdout, stderr } = await exec(`cd ${tempDir} && bun index.ts`);
    const jsonStartIndex = stdout.indexOf('{"json":');
    const jsonEndIndex = stdout.lastIndexOf("}") + 1;
    const jsonOutput = stdout.slice(jsonStartIndex, jsonEndIndex);
    console.log("[executeFunction] Code execution completed");
    if (stderr && !jsonOutput) {
      console.error(`[executeFunction] Error during execution: ${stderr}`);
      return;
    }
    console.log("[executeFunction] Parsing execution output");
    const parsedOutput = superjson.parse(jsonOutput);
    console.log("[executeFunction] Execution completed successfully");
    return parsedOutput;
  } catch (error) {
    console.error(`[executeFunction] Execution failed: ${error}`);
  }
}
