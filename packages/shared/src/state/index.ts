// Workspace utilities

// Active projects
export {
  type ActiveProject,
  type ActiveProjectsState,
  getActiveProjectIds,
  loadActiveProjects,
  saveActiveProjects,
  trackProjectActivity,
} from "./active-projects";
// Branch state
export {
  BRANCH_STATE_FILE,
  type BranchMetadata,
  type BranchState,
} from "./branch-state";
// Dev servers
export {
  DEV_SERVERS_FILE,
  type DevServerMetadata,
  type DevServersState,
} from "./dev-servers";
export {
  getBranchDir,
  getMainRepoPath,
  getProjectDir,
  initializeWorkspace,
  isCloudMode,
  isLocalMode,
  WORKSPACE_BASE,
  WORKSPACE_DIR,
} from "./workspace";
