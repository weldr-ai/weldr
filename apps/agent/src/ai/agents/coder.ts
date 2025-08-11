import { streamText, type ToolSet } from "ai";
import type { z } from "zod";

import { db, eq } from "@weldr/db";
import { declarations, tasks, versions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type {
  addMessageItemSchema,
  assistantMessageContentSchema,
} from "@weldr/shared/validators/chats";

import {
  deleteFileTool,
  doneTool,
  editFileTool,
  findTool,
  fzfTool,
  grepTool,
  listDirTool,
  readFileTool,
  searchCodebaseTool,
  writeFileTool,
} from "@/ai/tools";
import { getMessages } from "@/ai/utils/get-messages";
import { insertMessages } from "@/ai/utils/insert-messages";
import { registry } from "@/ai/utils/registry";
import { getTaskExecutionPlan, type TaskWithRelations } from "@/ai/utils/tasks";
import { stream } from "@/lib/stream-utils";
import type { WorkflowContext } from "@/workflow/context";
import { prompts } from "../prompts";
import { queryRelatedDeclarationsTool } from "../tools/query-related-declarations";
import { formatTaskDeclarationToMarkdown } from "../utils/formatters";
import { calculateModelCost } from "../utils/providers-pricing";

export async function coderAgent({
  context,
  coolDownPeriod = 1000,
}: {
  context: WorkflowContext;
  coolDownPeriod?: number;
}) {
  const project = context.get("project");
  const version = context.get("version");

  const logger = Logger.get({
    projectId: project.id,
    versionId: version.id,
  });

  logger.info("Starting coder agent");

  const executionPlan = await getTaskExecutionPlan({
    versionId: version.id,
  });

  logger.info(`Execution plan retrieved with ${executionPlan.length} tasks.`);

  const currentProgress: Map<
    string,
    {
      summary: string;
      progress: "pending" | "in_progress" | "completed";
    }
  > = new Map();

  for (const task of executionPlan) {
    const taskName = task.data.summary;

    logger.info(`Processing task: ${taskName}`);

    // Update task status to in_progress
    await db
      .update(tasks)
      .set({ status: "in_progress" })
      .where(eq(tasks.id, task.id));

    const { taskContext, declaration } = await createTaskContext(task);

    if (declaration) {
      await db
        .update(declarations)
        .set({ progress: "in_progress" })
        .where(eq(declarations.id, declaration.id));

      await updateCanvasNode({ context, declarationId: declaration.id });
    }

    await executeTaskWithContext(
      task,
      taskContext,
      context,
      currentProgress,
      coolDownPeriod,
    );

    await db
      .update(tasks)
      .set({ status: "completed" })
      .where(eq(tasks.id, task.id));

    currentProgress.set(task.id, {
      summary: task.data.summary,
      progress: "completed",
    });
  }

  logger.info("All tasks processed. Updating version progress to 'deploying'.");
  await db
    .update(versions)
    .set({ status: "deploying" })
    .where(eq(versions.id, version.id));

  // Update context with the new version status
  const updatedVersion = { ...version, status: "deploying" as const };
  context.set("version", updatedVersion);

  // Notify the stream about the status change
  await stream(version.chatId, {
    type: "update_project",
    data: {
      currentVersion: {
        status: "deploying",
      },
    },
  });

  logger.info("Coder agent completed");

  // End the stream
  await stream(version.chatId, { type: "end" });
}

async function executeTaskCoder({
  context,
  task,
  loopChatId,
  progress,
  coolDownPeriod = 1000,
}: {
  context: WorkflowContext;
  task: TaskWithRelations;
  loopChatId: string;
  progress: Map<
    string,
    {
      summary: string;
      progress: "pending" | "in_progress" | "completed";
    }
  >;
  coolDownPeriod?: number;
}) {
  const project = context.get("project");
  const version = context.get("version");
  const user = context.get("user");

  const logger = Logger.get({
    projectId: project.id,
    versionId: version.id,
    taskId: task.id,
  });

  logger.info("Starting task coder");

  const tools: ToolSet = {
    list_dir: listDirTool(context),
    read_file: readFileTool(context),
    write_file: writeFileTool(context),
    delete_file: deleteFileTool(context),
    edit_file: editFileTool(context),
    search_codebase: searchCodebaseTool(context),
    query_related_declarations: queryRelatedDeclarationsTool(context),
    fzf: fzfTool(context),
    grep: grepTool(context),
    find: findTool(context),
    done: doneTool(context),
  };

  const versionContext = `${version.message}
  Description: ${version.description}
  Acceptance Criteria: ${version.acceptanceCriteria}
  Progress:
  ${Array.from(progress.entries())
    .map(([id, { summary, progress }]) => `${id}: ${summary} - ${progress}`)
    .join("\n")}`;

  const system = await prompts.generalCoder(project, versionContext);

  // Local function to execute coder agent and handle tool calls
  const executeCoderLoop = async (): Promise<boolean> => {
    let shouldRecur = false;
    const hasToolErrors = false;
    const promptMessages = await getMessages(loopChatId);

    const result = streamText({
      model: registry.languageModel("google:gemini-2.5-pro"),
      system,
      tools,
      messages: promptMessages,
      onError: (error) => {
        logger.error("Error in coder agent", {
          extra: { error },
        });
      },
    });

    const assistantContent: z.infer<typeof assistantMessageContentSchema>[] =
      [];
    // Messages to save
    const messagesToSave: z.infer<typeof addMessageItemSchema>[] = [];
    const toolResultMessages: z.infer<typeof addMessageItemSchema>[] = [];

    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        const lastItem = assistantContent[assistantContent.length - 1];
        if (lastItem && lastItem.type === "text") {
          lastItem.text += part.text;
        } else {
          assistantContent.push({
            type: "text",
            text: part.text,
          });
        }
      } else if (part.type === "tool-call") {
        assistantContent.push({
          type: "tool-call",
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input,
        });
      } else if (part.type === "tool-result") {
        toolResultMessages.push({
          visibility: "internal",
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output: part.output,
            },
          ],
        });

        if (part.toolName === "done") {
          shouldRecur = false;
        } else {
          shouldRecur = true;
        }
      } else if (part.type === "tool-error") {
        toolResultMessages.push({
          visibility: "internal",
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
              output: part.error,
              isError: true,
            },
          ],
        });
        shouldRecur = true;
      }
    }

    if (hasToolErrors) {
      shouldRecur = true;
      logger.info("Continuing loop due to tool errors");
    }

    const usage = await result.usage;

    const cost = await calculateModelCost(
      "google:gemini-2.5-pro",
      usage?.inputTokens ?? 0,
      usage?.outputTokens ?? 0,
    );

    const finishReason = await result.finishReason;

    // Add assistant message - all coder activities are internal
    if (assistantContent.length > 0) {
      messagesToSave.push({
        visibility: "internal",
        role: "assistant",
        content: assistantContent,
        metadata: {
          provider: "google",
          model: "gemini-2.5-pro",
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          totalTokens: usage?.totalTokens,
          inputCost: cost?.inputCost,
          outputCost: cost?.outputCost,
          totalCost: cost?.totalCost,
          inputTokensPrice: cost?.inputTokensPrice,
          outputTokensPrice: cost?.outputTokensPrice,
          inputImagesPrice: cost?.inputImagesPrice,
          finishReason,
        },
      });
    }

    messagesToSave.push(...toolResultMessages);

    // Store messages if any (tool results are already saved immediately)
    if (messagesToSave.length > 0) {
      await insertMessages({
        input: {
          chatId: version.chatId,
          userId: user.id,
          messages: messagesToSave,
        },
      });
    }

    return shouldRecur;
  };

  // Main execution loop for the coder agent
  let shouldContinue = true;
  let iterationCount = 0;
  while (shouldContinue) {
    iterationCount++;
    logger.info(
      `Starting coder agent iteration ${iterationCount} for task ${task.id}`,
    );

    shouldContinue = await executeCoderLoop();

    logger.info(
      `Coder agent iteration ${iterationCount} completed for task ${task.id}`,
      {
        extra: { shouldContinue },
      },
    );

    if (shouldContinue) {
      logger.info(`Recurring in ${coolDownPeriod}ms...`);
      await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));
    }
  }

  logger.info(`Coder agent completed for task ${task.id}`);
}

async function updateCanvasNode({
  context,
  declarationId,
}: {
  context: WorkflowContext;
  declarationId: string;
}) {
  const project = context.get("project");
  const version = context.get("version");

  const logger = Logger.get({
    projectId: project.id,
    versionId: version.id,
    declarationId,
  });

  try {
    const updatedDeclaration = await db.query.declarations.findFirst({
      where: eq(declarations.id, declarationId),
      with: { node: true },
    });

    if (!updatedDeclaration) {
      throw new Error("Declaration not found");
    }

    if (updatedDeclaration.node && updatedDeclaration.metadata?.specs) {
      await stream(version.chatId, {
        type: "node",
        nodeId: updatedDeclaration.node.id,
        position: updatedDeclaration.node.position,
        metadata: updatedDeclaration.metadata,
        progress: updatedDeclaration.progress,
        node: updatedDeclaration.node,
      });
    }
  } catch (error) {
    logger.warn("Failed to stream declaration progress start", {
      extra: { error, declarationId },
    });
  }
}

const createTaskContext = async (task: TaskWithRelations) => {
  const sharedContext = `Acceptance Criteria:
${task.data.acceptanceCriteria.map((criteria) => `- ${criteria}`).join("\n")}

${
  task.data.implementationNotes
    ? `Implementation Notes:
${task.data.implementationNotes.map((note) => `- ${note}`).join("\n")}
`
    : ""
}

${
  task.data.subTasks
    ? `Sub-tasks:
${task.data.subTasks.map((subTask) => `- ${subTask}`).join("\n")}
`
    : ""
}`;

  if (task.data.type === "declaration") {
    const declaration = task.declaration;

    if (!declaration) {
      throw new Error("Declaration not found");
    }

    const taskContext = `Your current task is to implement the following declaration:
---
${formatTaskDeclarationToMarkdown(declaration)}
${sharedContext}
---
Note:
- You can implement any utility functions, components, or other declarations you need to implement the declaration.
- Read the files you need and implement the required changes.
- Leverage the notes and sub-tasks to implement the declaration.`;

    return { taskContext, declaration };
  }

  // Handle generic tasks
  const taskContext = `Your current task is to implement the following:
---
Task: ${task.data.summary}
Description: ${task.data.description}
${sharedContext}
---
Note:
- You can implement any utility functions, components, or other declarations you need to implement the declaration.
- Read the files you need and implement the required changes.
- Leverage the notes and sub-tasks to implement the declaration.`;

  return { taskContext };
};

const executeTaskWithContext = async (
  task: TaskWithRelations,
  taskContext: string,
  context: WorkflowContext,
  currentProgress: Map<
    string,
    { summary: string; progress: "pending" | "in_progress" | "completed" }
  >,
  coolDownPeriod: number,
) => {
  const user = context.get("user");
  const loopChatId = task.chatId;

  await insertMessages({
    input: {
      chatId: loopChatId,
      userId: user.id,
      messages: [
        {
          visibility: "internal",
          role: "user",
          content: [{ type: "text", text: taskContext }],
        },
      ],
    },
  });

  await executeTaskCoder({
    context,
    task,
    loopChatId,
    progress: currentProgress,
    coolDownPeriod,
  });
};
