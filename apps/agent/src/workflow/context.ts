import type { User } from "@weldr/auth";
import type { branches, projects, versions } from "@weldr/db/schema";
import type { IntegrationCategoryKey } from "@weldr/shared/types";

export type ProjectWithConfig = typeof projects.$inferSelect & {
  integrationCategories: Set<IntegrationCategoryKey>;
};

type WorkflowContextStore = {
  project: ProjectWithConfig;
  branch: typeof branches.$inferSelect & {
    headVersion: typeof versions.$inferSelect;
  };
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
