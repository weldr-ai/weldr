import { join } from "node:path";

import { WORKSPACE_BASE } from "./workspace";

export const DEV_SERVERS_FILE = join(WORKSPACE_BASE, "weldr-dev-servers.json");

export interface DevServerMetadata {
  projectId: string;
  branchId: string;
  port: number;
  pid: number;
  lastAccessed: number;
  startedAt: number;
  command: string;
}

export interface DevServersState {
  servers: DevServerMetadata[];
}
