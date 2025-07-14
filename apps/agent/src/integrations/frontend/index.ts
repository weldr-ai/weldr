import { runCommand } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { integrationRegistry } from "../registry";
import type { IntegrationDefinition } from "../types";
import { combineResults, directoryExists, installPackages } from "../utils";

// Utility function to rename directory
async function renameDirectory(
  oldPath: string,
  newPath: string,
): Promise<boolean> {
  const result = await runCommand("mv", [oldPath, newPath], {
    cwd: WORKSPACE_DIR,
  });
  return result.success;
}

// Utility function to remove directory
async function removeDirectory(path: string): Promise<boolean> {
  const result = await runCommand("rm", ["-rf", path], { cwd: WORKSPACE_DIR });
  return result.success;
}

// Utility function to create directory
async function createDirectory(path: string): Promise<boolean> {
  const result = await runCommand("mkdir", ["-p", path], {
    cwd: WORKSPACE_DIR,
  });
  return result.success;
}

// Utility function to replace text in files
async function replaceTextInFiles(
  searchPattern: string,
  replacement: string,
): Promise<boolean> {
  const findCmd = `find ${WORKSPACE_DIR} -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/boilerplates/*" -exec sed -i.bak 's|${searchPattern}|${replacement}|g' {} \\;`;

  const result = await runCommand("sh", ["-c", findCmd], {
    cwd: WORKSPACE_DIR,
  });

  if (result.success) {
    // Remove backup files
    const cleanupCmd = `find ${WORKSPACE_DIR} -name "*.bak" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/boilerplates/*" -delete`;
    await runCommand("sh", ["-c", cleanupCmd], { cwd: WORKSPACE_DIR });
  }

  return result.success;
}

// Utility function to read and update package.json
function updatePackageJson(updates: {
  scripts?: Record<string, string>;
  removeDevDeps?: string[];
}): boolean {
  try {
    const packageJsonPath = join(WORKSPACE_DIR, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

    // Update scripts
    if (updates.scripts) {
      packageJson.scripts = { ...packageJson.scripts, ...updates.scripts };
    }

    // Remove dev dependencies
    if (updates.removeDevDeps && packageJson.devDependencies) {
      for (const pkg of updates.removeDevDeps) {
        delete packageJson.devDependencies[pkg];
      }
    }

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    return true;
  } catch (error) {
    console.error("Error updating package.json:", error);
    return false;
  }
}

const frontendIntegration: IntegrationDefinition = {
  key: "frontend",
  name: "Frontend Integration",
  description: "Adds React frontend capabilities to the project",
  preInstall: async () => {
    // Validate project structure
    const hasPackageJson = await directoryExists("package.json");
    if (!hasPackageJson) {
      return {
        success: false,
        message: "No package.json found in project root",
        errors: ["Package.json is required for frontend integration"],
      };
    }

    // Handle src -> server directory rename
    const hasSrcDir = await directoryExists("src");
    if (hasSrcDir) {
      const hasServerDir = await directoryExists("server");
      if (hasServerDir) {
        await removeDirectory("server");
      }

      const renamed = await renameDirectory("src", "server");
      if (!renamed) {
        return {
          success: false,
          message: "Failed to rename src directory to server",
          errors: ["Could not rename src directory to server"],
        };
      }
    } else {
      await createDirectory("server");
    }

    // Replace @/ with @server/ in all files
    const replaced = await replaceTextInFiles("@/", "@server/");
    if (!replaced) {
      return {
        success: false,
        message: "Failed to replace @/ with @server/",
        errors: ["Could not replace import paths"],
      };
    }

    return {
      success: true,
      message:
        "Pre-installation validation passed, directory renamed and imports updated",
    };
  },
  installPackages: async () => {
    const prodPackages = {
      "@hookform/resolvers": "^5.1.1",
      "@tanstack/react-query": "^5.82.0",
      "@tanstack/react-router": "^1.125.6",
      "@tanstack/react-router-with-query": "^1.125.6",
      "@tanstack/react-start": "^1.126.1",
      "class-variance-authority": "^0.7.1",
      clsx: "^2.1.1",
      cmdk: "^1.1.1",
      "date-fns": "^4.1.0",
      "embla-carousel-react": "^8.6.0",
      "input-otp": "^1.4.2",
      "lucide-react": "^0.525.0",
      "next-themes": "^0.4.6",
      "radix-ui": "^1.4.2",
      react: "^19.1.0",
      "react-day-picker": "^9.8.0",
      "react-dom": "^19.1.0",
      "react-hook-form": "^7.60.0",
      "react-resizable-panels": "^3.0.3",
      recharts: "^3.1.0",
      sonner: "^2.0.6",
      "tailwind-merge": "^3.3.1",
      tailwindcss: "^4.1.11",
      "tw-animate-css": "^1.3.5",
      vaul: "^1.1.2",
      zod: "^3.25.49",
    };

    const devPackages = {
      "@biomejs/biome": "2.1.1",
      "@tailwindcss/vite": "^4.1.11",
      "@types/react": "^19.1.8",
      "@types/react-dom": "^19.1.6",
      "@vitejs/plugin-react": "^4.6.0",
      vite: "^7.0.3",
      "vite-tsconfig-paths": "^5.1.4",
    };

    const results = await Promise.all([
      installPackages(prodPackages, false),
      installPackages(devPackages, true),
    ]);

    const installResult = combineResults(results);

    if (installResult.success) {
      // Update package.json: remove unwanted packages and update scripts
      const updated = updatePackageJson({
        removeDevDeps: ["tsx", "esbuild"],
        scripts: {
          dev: "vite dev",
          build: "vite build",
          start: "node .output/server/index.mjs",
          typecheck: "tsc --noEmit",
          check: "biome check --diagnostic-level=warn",
          "check:fix": "biome check --diagnostic-level=warn --write",
          clean: "rm -rf node_modules .output .nitro .vinxi",
        },
      });

      if (!updated) {
        return {
          success: false,
          message: "Failed to update package.json",
          errors: ["Could not update package.json scripts and dependencies"],
        };
      }
    }

    return installResult;
  },
};

// Register the integration
integrationRegistry.register(frontendIntegration);
