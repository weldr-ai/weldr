import { runCommand } from "@/lib/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import type {
  IntegrationCallbackResult,
  IntegrationPackageSets,
  IntegrationScriptSets,
} from "../types";
import { combineResults } from "./combine-results";

export async function installPackages(
  packagesSets: IntegrationPackageSets,
): Promise<IntegrationCallbackResult> {
  const results: IntegrationCallbackResult[] = [];

  for (const packages of packagesSets) {
    const runtimePackages = Object.entries(packages.runtime);
    const developmentPackages = Object.entries(packages.development);

    const runtimeInstallCommand = runtimePackages.map(([name, version]) =>
      version ? `${name}@${version}` : name,
    );

    const developmentInstallCommand = developmentPackages.map(
      ([name, version]) => (version ? `${name}@${version}` : name),
    );

    const target = packages.target;

    if (runtimeInstallCommand.length > 0) {
      const runtimeResult = await runCommand(
        "sh",
        [
          "-c",
          `pnpm add ${runtimeInstallCommand.join(" ")} -F @repo/${target}`,
        ],
        {
          cwd: WORKSPACE_DIR,
        },
      );

      results.push(runtimeResult);
    }

    if (developmentInstallCommand.length > 0) {
      const developmentResult = await runCommand(
        "sh",
        [
          "-c",
          `pnpm add -D ${developmentInstallCommand.join(" ")} -F @repo/${target}`,
        ],
        {
          cwd: WORKSPACE_DIR,
        },
      );

      results.push(developmentResult);
    }
  }

  return combineResults(results);
}

export async function updatePackageJsonScripts(
  scriptSets: IntegrationScriptSets,
): Promise<IntegrationCallbackResult> {
  try {
    const results: IntegrationCallbackResult[] = [];

    for (const scriptSet of scriptSets) {
      const directory =
        scriptSet.target === "root"
          ? WORKSPACE_DIR
          : `${WORKSPACE_DIR}/apps/${scriptSet.target}`;

      const packageJson = await runCommand("cat", ["package.json"], {
        cwd: directory,
      });

      if (!packageJson.success) {
        console.error("Failed to read package.json:", packageJson.stderr);
        return {
          success: false,
          message: `Failed to read package.json: ${packageJson.stderr}`,
          errors: [packageJson.stderr],
        };
      }

      const packageJsonContent = JSON.parse(packageJson.stdout);

      if (scriptSet.scripts) {
        packageJsonContent.scripts = {
          ...packageJsonContent.scripts,
          ...scriptSet.scripts,
        };
      }

      await runCommand("sh", ["-c", `cat > package.json`], {
        stdin: JSON.stringify(packageJsonContent, null, 2),
        cwd: directory,
      });

      results.push({
        success: true,
        message: `Successfully updated ${scriptSet.target} package.json scripts`,
      });
    }

    return combineResults(results);
  } catch (error) {
    console.error("Error updating package.json:", error);
    return {
      success: false,
      message: `Failed to update package.json scripts: ${error instanceof Error ? error.message : String(error)}`,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export async function runPnpmScript(
  script: string,
): Promise<IntegrationCallbackResult> {
  const result = await runCommand("pnpm", ["run", script], {
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
