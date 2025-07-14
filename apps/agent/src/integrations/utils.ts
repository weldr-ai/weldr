import { runCommand } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import type { IntegrationCallbackResult } from "./types";

export async function installPackages(
  packages: Record<string, string>,
  isDev = false,
): Promise<IntegrationCallbackResult> {
  const packageEntries = Object.entries(packages);
  if (packageEntries.length === 0) {
    return { success: true, message: "No packages to install" };
  }

  const installCommand = isDev ? "bun add --dev" : "bun add";
  const packageStrings = packageEntries.map(([name, version]) =>
    version ? `${name}@${version}` : name,
  );

  const result = await runCommand(
    "sh",
    ["-c", `${installCommand} ${packageStrings.join(" ")}`],
    {
      cwd: WORKSPACE_DIR,
    },
  );

  if (result.success) {
    return {
      success: true,
      message: `Successfully installed packages: ${packageStrings.join(", ")}`,
      installedPackages: packageStrings,
    };
  }

  return {
    success: false,
    message: `Failed to install packages: ${result.stderr}`,
    errors: [result.stderr],
  };
}

export async function runBunScript(
  script: string,
): Promise<IntegrationCallbackResult> {
  const result = await runCommand("bun", ["run", script], {
    cwd: WORKSPACE_DIR,
  });

  if (result.success) {
    return {
      success: true,
      message: `Successfully ran script: ${script}`,
    };
  }

  return {
    success: false,
    message: `Failed to run script ${script}: ${result.stderr}`,
    errors: [result.stderr],
  };
}

export async function createDirectory(
  path: string,
): Promise<IntegrationCallbackResult> {
  const result = await runCommand("mkdir", ["-p", path], {
    cwd: WORKSPACE_DIR,
  });

  if (result.success) {
    return {
      success: true,
      message: `Successfully created directory: ${path}`,
      createdFiles: [path],
    };
  }

  return {
    success: false,
    message: `Failed to create directory ${path}: ${result.stderr}`,
    errors: [result.stderr],
  };
}

export async function fileExists(path: string): Promise<boolean> {
  const result = await runCommand("test", ["-f", path], {
    cwd: WORKSPACE_DIR,
  });
  return result.success;
}

export async function directoryExists(path: string): Promise<boolean> {
  const result = await runCommand("test", ["-d", path], {
    cwd: WORKSPACE_DIR,
  });
  return result.success;
}

export function combineResults(
  results: IntegrationCallbackResult[],
): IntegrationCallbackResult {
  const success = results.every((r) => r.success);
  const messages = results.map((r) => r.message).filter(Boolean);
  const installedPackages = results.flatMap((r) => r.installedPackages || []);
  const createdFiles = results.flatMap((r) => r.createdFiles || []);
  const errors = results.flatMap((r) => r.errors || []);

  return {
    success,
    message: messages.join("; "),
    installedPackages,
    createdFiles,
    errors,
  };
}
