import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { isLocalMode, WORKSPACE_BASE } from "./workspace";

const ACTIVE_PROJECTS_FILE = join(WORKSPACE_BASE, "weldr-active-projects.json");

export interface ActiveProject {
  projectId: string;
  lastActivityAt: number;
  branches: string[];
}

export interface ActiveProjectsState {
  projects: Record<string, ActiveProject>;
}

/**
 * Load active projects metadata from file
 */
export function loadActiveProjects(): ActiveProjectsState {
  try {
    if (existsSync(ACTIVE_PROJECTS_FILE)) {
      const content = readFileSync(ACTIVE_PROJECTS_FILE, "utf-8");
      return JSON.parse(content) as ActiveProjectsState;
    }
  } catch (error) {
    console.warn("Failed to load active projects metadata", error);
  }
  return { projects: {} };
}

/**
 * Save active projects metadata
 */
export async function saveActiveProjects(
  state: ActiveProjectsState,
): Promise<void> {
  try {
    await writeFile(
      ACTIVE_PROJECTS_FILE,
      JSON.stringify(state, null, 2),
      "utf-8",
    );
  } catch (error) {
    console.error("Failed to save active projects metadata", error);
  }
}

/**
 * Track project activity (local mode only)
 */
export async function trackProjectActivity(
  projectId: string,
  branchId: string,
): Promise<void> {
  // Only track in local mode
  if (!isLocalMode()) {
    return;
  }

  const state = loadActiveProjects();

  if (!state.projects[projectId]) {
    state.projects[projectId] = {
      projectId,
      lastActivityAt: Date.now(),
      branches: [branchId],
    };
  } else {
    state.projects[projectId].lastActivityAt = Date.now();
    if (!state.projects[projectId].branches.includes(branchId)) {
      state.projects[projectId].branches.push(branchId);
    }
  }

  await saveActiveProjects(state);
}

/**
 * Get all active project IDs from metadata file
 * Returns empty array if not in local mode or if file doesn't exist
 */
export function getActiveProjectIds(): string[] {
  if (!isLocalMode()) {
    return [];
  }

  const state = loadActiveProjects();
  return Object.keys(state.projects);
}
