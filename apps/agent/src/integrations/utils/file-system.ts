import { runCommand } from "@/ai/utils/commands";
import { WORKSPACE_DIR } from "@/lib/constants";
import type { IntegrationCallbackResult } from "../types";

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

export async function renameDirectory(
  oldPath: string,
  newPath: string,
): Promise<boolean> {
  const result = await runCommand("mv", [oldPath, newPath], {
    cwd: WORKSPACE_DIR,
  });
  return result.success;
}

export async function removeDirectory(path: string): Promise<boolean> {
  const result = await runCommand("rm", ["-rf", path], { cwd: WORKSPACE_DIR });
  return result.success;
}

export async function replaceTextInFiles(
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

export function replacePatternInContent(
  content: string,
  searchPattern: string | RegExp,
  replacement: string,
): string {
  if (typeof searchPattern === "string") {
    return content.replace(new RegExp(searchPattern, "g"), replacement);
  }
  return content.replace(searchPattern, replacement);
}
