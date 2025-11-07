import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { isLocalMode } from "./mode";

// Active projects tracking is only used in local mode
// In cloud mode, each project has its own Fly.io machine
const WORKSPACE_BASE = join(homedir(), ".weldr");
const ACTIVE_PROJECTS_FILE = join(WORKSPACE_BASE, "active-projects.json");

interface ActiveProject {
  projectId: string;
  lastActivityAt: number;
  branches: string[];
}

interface ActiveProjectsState {
  projects: Record<string, ActiveProject>;
}

/**
 * Load active projects metadata
 */
export function loadActiveProjects(): ActiveProjectsState {
  try {
    if (existsSync(ACTIVE_PROJECTS_FILE)) {
      const content = readFileSync(ACTIVE_PROJECTS_FILE, "utf-8");
      return JSON.parse(content);
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
 * Get all active project IDs
 */
export function getActiveProjectIds(): string[] {
  const state = loadActiveProjects();
  return Object.keys(state.projects);
}

/**
 * Remove project from active list
 */
export async function removeActiveProject(projectId: string): Promise<void> {
  const state = loadActiveProjects();
  delete state.projects[projectId];
  await saveActiveProjects(state);
}
