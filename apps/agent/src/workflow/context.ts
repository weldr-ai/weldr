import type { User } from "@weldr/auth";
import type { projects, versions } from "@weldr/db/schema";

export type ProjectWithConfig = typeof projects.$inferSelect & {
  config: Set<"backend" | "frontend" | "authentication" | "database">;
};

type WorkflowContextStore = {
  project: ProjectWithConfig;
  version: typeof versions.$inferSelect;
  isXML: boolean;
  user: User;
};

export class WorkflowContext {
  private store: Partial<WorkflowContextStore> = {};

  public get<K extends keyof WorkflowContextStore>(
    key: K,
  ): WorkflowContextStore[K] {
    const value = this.store[key];
    if (value === undefined) {
      throw new Error(`Value for key "${key}" not found in WorkflowContext.`);
    }
    return value as WorkflowContextStore[K];
  }

  public set<K extends keyof WorkflowContextStore>(
    key: K,
    value: WorkflowContextStore[K],
  ): void {
    this.store[key] = value;
  }
}
