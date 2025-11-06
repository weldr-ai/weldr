import path from "node:path";

// Determine workspace base based on environment
// Development: use local tmp directory relative to agent app
// Production: use Docker volume mount at /workspace
export const WORKSPACE_BASE =
  process.env.NODE_ENV === "development"
    ? path.join(process.cwd(), "tmp")
    : "/workspace";

export const WORKSPACE_DIR = WORKSPACE_BASE;
export const BRANCH_METADATA_FILE = path.join(
  WORKSPACE_BASE,
  ".weldr-state.json",
);
export const MAX_VOLUME_USAGE_PERCENT = 85;
export const TARGET_VOLUME_USAGE_PERCENT = 70;
export const VOLUME_SIZE_GB = 20;

/**
 * Resolve script path based on environment
 * Development: use local scripts directory
 * Production: use installed scripts in /usr/local/bin
 */
export function resolveScriptPath(scriptName: string): string {
  return process.env.NODE_ENV === "development"
    ? path.join(process.cwd(), "scripts", scriptName)
    : `/usr/local/bin/${scriptName}`;
}

/**
 * Initialize workspace directory
 * Creates the tmp directory in development mode if it doesn't exist
 */
export async function initializeWorkspace(): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    const fs = await import("node:fs/promises");
    try {
      await fs.mkdir(WORKSPACE_BASE, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
      if ((error as { code?: string }).code !== "EEXIST") {
        throw error;
      }
    }
  }
}
