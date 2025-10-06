import { promises as fs } from "node:fs";

import type { branches } from "@weldr/db/schema";

import { runCommand } from "@/lib/commands";
import { Git } from "@/lib/git";
import type {
  IntegrationCallbackResult,
  IntegrationPackageSets,
  IntegrationScriptSets,
} from "../types";
import { combineResults } from "./combine-results";

export async function installPackages(
  packagesSets: IntegrationPackageSets,
  branch: typeof branches.$inferSelect,
): Promise<IntegrationCallbackResult> {
  const workspaceDir = Git.getBranchWorkspaceDir(branch.id, branch.isMain);

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
          cwd: workspaceDir,
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
          cwd: workspaceDir,
        },
      );

      results.push(developmentResult);
    }
  }

  return combineResults(results);
}

export async function updatePackageJsonScripts(
  scriptSets: IntegrationScriptSets,
  branch: typeof branches.$inferSelect,
): Promise<IntegrationCallbackResult> {
  try {
    const workspaceDir = Git.getBranchWorkspaceDir(branch.id, branch.isMain);

    const results: IntegrationCallbackResult[] = [];

    for (const scriptSet of scriptSets) {
      const directory =
        scriptSet.target === "root"
          ? workspaceDir
          : `${workspaceDir}/apps/${scriptSet.target}`;

      let packageJsonContent: {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      } = {};

      try {
        const packageJsonPath = `${directory}/package.json`;
        const fileContent = await fs.readFile(packageJsonPath, "utf-8");
        packageJsonContent = JSON.parse(fileContent);
      } catch (error) {
        console.error("Failed to read package.json:", error);
        return {
          success: false,
          message: `Failed to read package.json: ${error instanceof Error ? error.message : String(error)}`,
          errors: [error instanceof Error ? error.message : String(error)],
        };
      }

      if (scriptSet.scripts) {
        packageJsonContent.scripts = {
          ...packageJsonContent.scripts,
          ...scriptSet.scripts,
        };
      }

      try {
        const packageJsonPath = `${directory}/package.json`;
        await fs.writeFile(
          packageJsonPath,
          JSON.stringify(packageJsonContent, null, 2),
          "utf-8",
        );
      } catch (error) {
        return {
          success: false,
          message: `Failed to write package.json: ${error instanceof Error ? error.message : String(error)}`,
          errors: [error instanceof Error ? error.message : String(error)],
        };
      }

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
  branch: typeof branches.$inferSelect,
): Promise<IntegrationCallbackResult> {
  const workspaceDir = Git.getBranchWorkspaceDir(branch.id, branch.isMain);

  const result = await runCommand("pnpm", ["run", script], {
    cwd: workspaceDir,
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
