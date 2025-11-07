import { homedir } from "node:os";
import path from "node:path";

/**
 * Check if running in local mode (local development)
 * vs cloud mode (Fly.io infrastructure)
 *
 * Uses WELDR_MODE environment variable:
 * - "local" or unset = local mode
 * - "cloud" = cloud mode
 *
 * Falls back to NODE_ENV if WELDR_MODE is not set for backwards compatibility
 */
export function isLocalMode(): boolean {
  const mode = process.env.WELDR_MODE?.toLowerCase();
  if (mode === "cloud") return false;
  if (mode === "local") return true;
  // Fallback to NODE_ENV for backwards compatibility
  return process.env.NODE_ENV === "development";
}

export function isCloudMode(): boolean {
  return !isLocalMode();
}

// Determine workspace base based on deployment mode
// Local: use ~/.weldr directory for shared access between agent and web app
// Cloud: use Docker volume mount at /workspace
export const WORKSPACE_BASE = isLocalMode()
  ? path.join(homedir(), ".weldr")
  : "/workspace";

export const WORKSPACE_DIR = WORKSPACE_BASE;

/**
 * Get the project directory path (local mode only)
 */
export function getProjectDir(projectId: string): string {
  return path.join(WORKSPACE_BASE, projectId);
}

/**
 * Get the branch directory path
 * Local mode: ~/.weldr/{projectId}/{branchId}
 * Cloud mode: /workspace/{branchId}
 */
export function getBranchDir(projectId: string, branchId: string): string {
  if (isLocalMode()) {
    return path.join(WORKSPACE_BASE, projectId, branchId);
  }
  // Cloud mode: flat structure with just branchId (one project per machine)
  return path.join(WORKSPACE_BASE, branchId);
}

/**
 * Get the main git repository path from project ID and main branch ID
 * Local mode: ~/.weldr/{projectId}/{mainBranchId}
 * Cloud mode: /workspace/{mainBranchId}
 */
export function getMainRepoPath(
  projectId: string,
  mainBranchId: string,
): string {
  if (isLocalMode()) {
    return path.join(WORKSPACE_BASE, projectId, mainBranchId);
  }
  // Cloud mode: flat structure with just branchId (one project per machine)
  return path.join(WORKSPACE_BASE, mainBranchId);
}

/**
 * Initialize workspace directory
 * Creates the ~/.weldr directory in local mode if it doesn't exist
 */
export async function initializeWorkspace(): Promise<void> {
  if (isLocalMode()) {
    const fs = await import("node:fs/promises");
    try {
      await fs.mkdir(WORKSPACE_BASE, { recursive: true });
      console.log(`📁 Workspace initialized at: ${WORKSPACE_BASE}`);
    } catch (error) {
      // Ignore if directory already exists
      if ((error as { code?: string }).code !== "EEXIST") {
        throw error;
      }
    }
  }
}
