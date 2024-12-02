import Handlebars from "handlebars";
import { exec as exec_ } from "node:child_process";
import fs from "node:fs/promises";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import superjson from "superjson";
import type { Dependency, Utility } from "./index";

const exec = promisify(exec_);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createTemporaryDirectory() {
  console.log("[createTemporaryDirectory] Creating temporary directory...");
  const tempDir = path.join(__dirname, "temp");
  await fs.mkdir(tempDir, { recursive: true });
  console.log(
    "[createTemporaryDirectory] Temporary directory created successfully",
  );
  console.log(
    `[createTemporaryDirectory] Temporary directory path: ${tempDir}`,
  );
  return tempDir;
}

async function generatePackage({
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
    path.join(__dirname, "templates", "index.hbs"),
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
    path.join(__dirname, "templates", "package.json"),
    path.join(tempDir, "package.json"),
  );
  console.log("[generatePackage] Package.json copied successfully");
  console.log("[generatePackage] Node.js project setup complete");
}

async function installDependencies(
  tempDir: string,
  dependencies: Dependency[],
) {
  console.log("[installDependencies] Starting dependency installation...");
  console.log(
    `[installDependencies] Installing packages: ${dependencies.map(({ name, version }) => `${name}${version ? `@${version}` : ""}`).join(", ")}`,
  );
  await exec(
    `cd ${tempDir} && bun add ${dependencies.map(({ name, version }) => `${name}${version ? `@${version}` : ""}`).join(" ")}`,
  );
  console.log("[installDependencies] Dependencies installed successfully");
}

async function createLibraries(
  tempDir: string,
  utilities: Utility[],
  environmentVariablesMap?: Record<string, string>,
) {
  const groupedUtilities = utilities.reduce(
    (acc, utility) => {
      const key = utility.filePath;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(utility);
      return acc;
    },
    {} as Record<string, Utility[]>,
  );

  for (const [utilityPath, lib] of Object.entries(groupedUtilities)) {
    if (!lib || lib.length === 0) continue;

    const utilityDir = path.join(tempDir, "lib", path.dirname(utilityPath));

    console.log(`[createLibraries] Creating directory: ${utilityDir}`);
    await fs.mkdir(utilityDir, { recursive: true });

    const fullPath = path.join(tempDir, "lib", utilityPath);
    console.log(`[createLibraries] Creating file: ${fullPath}`);

    const template = lib.map(({ content }) => content).join("\n");
    const compiledTemplate = Handlebars.compile(template, { noEscape: true });
    const fileContent = compiledTemplate(environmentVariablesMap);

    await fs.writeFile(fullPath, fileContent);

    console.log(`[createLibraries] File created: ${fullPath}`);
  }

  console.log("[createLibraries] All libraries created successfully");
}

async function writeTestEnvFile(
  tempDir: string,
  testEnv: { key: string; value: string }[],
) {
  try {
    const envPath = path.join(tempDir, ".env");
    console.log("[writeEnvFile] Writing to:", envPath);

    const envContent = testEnv
      .map(({ key, value }) => `${key}=${value}`)
      .join("\n");
    await fs.writeFile(envPath, envContent);

    console.log("[writeEnvFile] Environment variables written successfully");
  } catch (error) {
    console.error("[writeEnvFile] Failed to write .env file:", error);
  }
}

export async function executeCode({
  code,
  functionName,
  functionArgs,
  hasInput,
  utilities,
  dependencies,
  environmentVariablesMap,
  testEnv,
}: {
  code: string;
  hasInput: boolean;
  functionName: string;
  functionArgs?: Record<string, unknown>;
  utilities?: Utility[];
  dependencies?: Dependency[];
  environmentVariablesMap?: Record<string, string>;
  testEnv?: { key: string; value: string }[];
}) {
  console.log("[executeCode] Starting code execution process...");
  const tempDir = await createTemporaryDirectory();
  await generatePackage({
    tempDir,
    code,
    functionName,
    functionArgs,
    hasInput,
  });

  if (utilities && utilities.length > 0) {
    console.log("[executeCode] Setting up utilities...");
    await createLibraries(tempDir, utilities, environmentVariablesMap);
  }

  if (dependencies && dependencies.length > 0) {
    console.log("[executeCode] Installing additional dependencies...");
    await installDependencies(tempDir, dependencies);
  }

  if (
    testEnv &&
    Object.keys(testEnv).length > 0 &&
    process.env.NODE_ENV === "development"
  ) {
    console.log("[executeCode] Writing environment variables...");
    await writeTestEnvFile(tempDir, testEnv);
  }

  try {
    console.log("[executeCode] Executing user code...");
    const { stdout, stderr } = await exec(`cd ${tempDir} && bun index.ts`);
    const jsonStartIndex = stdout.indexOf('{"json":');
    const jsonEndIndex = stdout.lastIndexOf("}") + 1;
    const jsonOutput = stdout.slice(jsonStartIndex, jsonEndIndex);
    console.log("[executeCode] Code execution completed");
    if (stderr && !jsonOutput) {
      console.error(`[executeCode] Error during execution: ${stderr}`);
      return;
    }
    console.log("[executeCode] Parsing execution output");
    const parsedOutput = superjson.parse(jsonOutput);
    console.log("[executeCode] Execution completed successfully");
    return parsedOutput;
  } catch (error) {
    console.error(`[executeCode] Execution failed: ${error}`);
  }
}
