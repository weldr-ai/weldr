import { codingWorkflow } from "@/mastra/workflows";
import type { TStreamableValue } from "@/types";
import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { PinoLogger } from "@mastra/loggers";
import type { User } from "@weldr/auth";
import type { projects, versions } from "@weldr/db/schema";

export interface StreamWriter {
  write(chunk: TStreamableValue): Promise<void>;
  close(): Promise<void>;
}

// Global type declarations
declare global {
  var sseConnections: Map<string, StreamWriter> | undefined;
}

export type AgentRuntimeContext = {
  project: typeof projects.$inferSelect;
  version: typeof versions.$inferSelect;
  user: User;
  streamWriter: StreamWriter;
};

export const mastra = new Mastra({
  workflows: {
    codingWorkflow,
  },
  storage: new LibSQLStore({
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
