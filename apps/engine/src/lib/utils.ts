import Handlebars from "handlebars";
import { exec as exec_ } from "node:child_process";
import fs from "node:fs/promises";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { Dependency, Module } from "..";

export const exec = promisify(exec_);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function createTemporaryDirectory() {
  console.log("[createTemporaryDirectory] Creating temporary directory...");
  const tempDir = path.join(__dirname, "..", "..", "temp");
  await fs.mkdir(tempDir, { recursive: true });
  console.log(
    "[createTemporaryDirectory] Temporary directory created successfully",
  );
  console.log(
    `[createTemporaryDirectory] Temporary directory path: ${tempDir}`,
  );
  return tempDir;
}

export async function installDependencies({
  tempDir,
  dependencies,
}: {
  tempDir: string;
  dependencies: Dependency[];
}) {
  console.log("[installDependencies] Starting dependency installation...");
  console.log(
    `[installDependencies] Installing packages: ${dependencies.map(({ name, version }) => `${name}${version ? `@${version}` : ""}`).join(", ")}`,
  );
  await exec(
    `cd ${tempDir} && bun add ${dependencies.map(({ name, version }) => `${name}${version ? `@${version}` : ""}`).join(" ")}`,
  );
  console.log("[installDependencies] Dependencies installed successfully");
}

export async function writeTestEnvFile({
  tempDir,
  testEnv,
}: {
  tempDir: string;
  testEnv: { key: string; value: string }[];
}) {
  try {
    const envPath = path.join(tempDir, ".env");
    console.log("[writeTestEnvFile] Writing to:", envPath);

    const envContent = testEnv
      .map(({ key, value }) => `${key}=${value}`)
      .join("\n");
    await fs.writeFile(envPath, envContent);

    console.log(
      "[writeTestEnvFile] Environment variables written successfully",
    );
  } catch (error) {
    console.error("[writeTestEnvFile] Failed to write .env file:", error);
  }
}

export async function createLibraries({
  tempDir,
  modules,
  environmentVariablesMap,
}: {
  tempDir: string;
  modules: Module[];
  environmentVariablesMap?: Record<string, string>;
}) {
  const groupedModules = modules.reduce(
    (acc, module) => {
      const key = module.path;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(module);
      return acc;
    },
    {} as Record<string, Module[]>,
  );

  for (const [modulePath, lib] of Object.entries(groupedModules)) {
    if (!lib || lib.length === 0) continue;

    const moduleDir = path.join(tempDir, "lib", path.dirname(modulePath));

    console.log(`[createLibraries] Creating directory: ${moduleDir}`);
    await fs.mkdir(moduleDir, { recursive: true });

    const fullPath = path.join(tempDir, "lib", modulePath);
    console.log(`[createLibraries] Creating file: ${fullPath}`);

    const template = lib.map(({ content }) => content).join("\n");
    const compiledTemplate = Handlebars.compile(template, { noEscape: true });
    const fileContent = compiledTemplate(environmentVariablesMap);

    await fs.writeFile(fullPath, fileContent);

    console.log(`[createLibraries] File created: ${fullPath}`);
  }

  console.log("[createLibraries] All libraries created successfully");
}
