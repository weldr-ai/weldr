export type TPendingMessage =
  | "thinking"
  | "generating"
  | "waiting"
  | "building"
  | "enriching"
  | "deploying"
  | null;

export type TextStreamableValue = {
  type: "text";
  text: string;
};

export type EndStreamableValue = {
  type: "end";
};

export type ToolStreamableValue = {
  id?: string;
  type: "tool";
  toolName: "setupIntegration";
  toolArgs?: Record<string, unknown>;
  toolResult: unknown;
};

export type CoderStreamableValue =
  | {
      id?: string;
      type: "coder";
      status: "initiated" | "coded" | "enriched" | "succeeded" | "failed";
    }
  | {
      id?: string;
      type: "coder";
      status: "deployed";
    };

export type VersionStreamableValue = {
  id?: string;
  createdAt?: Date;
  type: "version";
  versionId: string;
  versionMessage: string;
  versionNumber: number;
  versionDescription: string;
  changedFiles: {
    path: string;
    status: "pending" | "success";
  }[];
};

export type TStreamableValue =
  | TextStreamableValue
  | ToolStreamableValue
  | VersionStreamableValue
  | CoderStreamableValue
  | EndStreamableValue;
