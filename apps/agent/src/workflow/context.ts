import type { StreamWriter } from "@/lib/utils";
import type { User } from "@weldr/auth";
import type { projects, versions } from "@weldr/db/schema";

type WorkflowContextStore = {
  project: typeof projects.$inferSelect;
  version: typeof versions.$inferSelect;
  user: User;
  streamWriter: StreamWriter;
};

export class WorkflowContext {
  private store: Partial<WorkflowContextStore> = {};

  public get<K extends keyof WorkflowContextStore>(
    key: K,
  ): WorkflowContextStore[K] {
    const value = this.store[key];
    if (value === undefined) {
      throw new Error(`Value for key "${key}" not found in AgentContext.`);
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
