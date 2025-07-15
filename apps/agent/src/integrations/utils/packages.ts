import { runCommand } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import type { IntegrationCallbackResult } from "../types";

export async function installPackages({
  packages,
  isDev = false,
}: {
  packages: Record<string, string>;
  isDev?: boolean;
}): Promise<IntegrationCallbackResult> {
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

export async function removePackages(
  packageNames: string[],
): Promise<IntegrationCallbackResult> {
  const result = await runCommand(
    "sh",
    ["-c", `bun remove ${packageNames.join(" ")}`],
    {
      cwd: WORKSPACE_DIR,
    },
  );

  if (result.success) {
    return {
      success: true,
      message: `Successfully removed packages: ${packageNames.join(", ")}`,
    };
  }

  return {
    success: false,
    message: `Failed to remove packages: ${result.stderr}`,
    errors: [result.stderr],
  };
}

export async function updatePackageJsonScripts(
  scripts: Record<string, string>,
): Promise<IntegrationCallbackResult> {
  try {
    const packageJson = await runCommand("cat", ["package.json"], {
      cwd: WORKSPACE_DIR,
    });

    if (!packageJson.success) {
      return {
        success: false,
        message: `Failed to read package.json: ${packageJson.stderr}`,
        errors: [packageJson.stderr],
      };
    }

    const packageJsonContent = JSON.parse(packageJson.stdout);

    if (scripts) {
      packageJsonContent.scripts = {
        ...packageJsonContent.scripts,
        ...scripts,
      };
    }

    await runCommand("echo", [JSON.stringify(packageJsonContent, null, 2)], {
      cwd: WORKSPACE_DIR,
    });

    return {
      success: true,
      message: "Successfully updated package.json scripts",
    };
  } catch (error) {
    console.error("Error updating package.json:", error);
    return {
      success: false,
      message: `Failed to update package.json scripts: ${error instanceof Error ? error.message : String(error)}`,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
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
