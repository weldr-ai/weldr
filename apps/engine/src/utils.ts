import { exec as exec_ } from "node:child_process";
import fs from "node:fs/promises";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import Handlebars from "handlebars";
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

async function createUtilityFiles(tempDir: string, utilities: Utility[]) {
  for (const utility of utilities) {
    const utilityPath = path.join(tempDir, "lib", utility.filePath);
    const utilityDir = path.dirname(utilityPath);

    console.log(`[createUtilityFiles] Creating directory: ${utilityDir}`);
    await fs.mkdir(utilityDir, { recursive: true });

    console.log(`[createUtilityFiles] Creating file: ${utility.filePath}`);
    await fs.writeFile(utilityPath, utility.content);
    console.log(`[createUtilityFiles] File created: ${utility.filePath}`);
  }
  console.log("[createUtilityFiles] All utility files created successfully");
}

export async function executeCode({
  code,
  functionName,
  functionArgs,
  hasInput,
  utilities,
  dependencies,
}: {
  code: string;
  hasInput: boolean;
  functionName: string;
  functionArgs?: Record<string, unknown>;
  utilities?: Utility[];
  dependencies?: Dependency[];
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
    await createUtilityFiles(tempDir, utilities);
  }

  if (dependencies && dependencies.length > 0) {
    console.log("[executeCode] Installing additional dependencies...");
    await installDependencies(tempDir, dependencies);
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
