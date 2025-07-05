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
import { type TaskWithRelations, getTaskExecutionPlan } from "@/ai/utils/tasks";
import type { WorkflowContext } from "@/workflow/context";
import { db, eq } from "@weldr/db";
import { declarations, tasks, versions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type {
  addMessageItemSchema,
  assistantMessageContentSchema,
} from "@weldr/shared/validators/chats";
import { streamText } from "ai";
import type { z } from "zod";
import { prompts } from "../prompts";
import { queryRelatedDeclarationsTool } from "../tools/query-related-declarations";
import { formatTaskDeclarationToMarkdown } from "../utils/formetters";
import { calculateModelCost } from "../utils/providers-pricing";
import { XMLProvider } from "../utils/xml-provider";

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

  const streamWriter = global.sseConnections?.get(
    context.get("version").chatId,
  );
  if (!streamWriter) {
    throw new Error("Stream writer not found");
  }

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

  logger.info("All tasks processed. Updating version progress to 'completed'.");
  await db
    .update(versions)
    .set({ status: "completed" })
    .where(eq(versions.id, version.id));

  logger.info("Coder agent completed");

  // End the stream
  await streamWriter.write({ type: "end" });
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
  const isXML = context.get("isXML");

  const logger = Logger.get({
    projectId: project.id,
    versionId: version.id,
    taskId: task.id,
  });

  logger.info("Starting task coder");

  const xmlProvider = new XMLProvider(
    [
      listDirTool.getXML(),
      readFileTool.getXML(),
      writeFileTool.getXML(),
      deleteFileTool.getXML(),
      editFileTool.getXML(),
      searchCodebaseTool.getXML(),
      queryRelatedDeclarationsTool.getXML(),
      fzfTool.getXML(),
      grepTool.getXML(),
      findTool.getXML(),
      doneTool.getXML(),
    ],
    context,
  );

  const versionContext = `${version.message}
  Description: ${version.description}
  Acceptance Criteria: ${version.acceptanceCriteria}
  Progress:
  ${Array.from(progress.entries())
    .map(([id, { summary, progress }]) => `${id}: ${summary} - ${progress}`)
    .join("\n")}`;

  const system = isXML
    ? await prompts.generalCoder(
        project,
        xmlProvider.getSpecsMarkdown(),
        versionContext,
      )
    : await prompts.generalCoder(project, versionContext);

  // Local function to execute coder agent and handle tool calls
  const executeCoderLoop = async (): Promise<boolean> => {
    let shouldRecur = false;
    const promptMessages = await getMessages(loopChatId);

    const result = isXML
      ? xmlProvider.streamText({
          model: registry.languageModel("google:gemini-2.5-pro"),
          system,
          messages: promptMessages,
          onError: (error) => {
            logger.error("Error in coder agent", {
              extra: { error },
            });
          },
        })
      : streamText({
          model: registry.languageModel("google:gemini-2.5-pro"),
          system,
          tools: {
            list_dir: listDirTool(context),
            read_file: readFileTool(context),
            edit_file: editFileTool(context),
            write_file: writeFileTool(context),
            delete_file: deleteFileTool(context),
            search_codebase: searchCodebaseTool(context),
            query_related_declarations: queryRelatedDeclarationsTool(context),
            fzf: fzfTool(context),
            grep: grepTool(context),
            find: findTool(context),
            done: doneTool(context),
          },
          messages: promptMessages,
          onError: (error) => {
            logger.error("Error in coder agent", {
              extra: { error },
            });
          },
        });

    // Assistant message content
    const assistantContent: z.infer<typeof assistantMessageContentSchema>[] =
      [];
    // Messages to save
    const messagesToSave: z.infer<typeof addMessageItemSchema>[] = [];
    const toolResultMessages: z.infer<typeof addMessageItemSchema>[] = [];

    // Process the stream and handle tool calls
    for await (const delta of result.fullStream) {
      if (delta.type === "text-delta") {
        // Add text content immediately to maintain proper order
        const lastItem = assistantContent[assistantContent.length - 1];
        if (lastItem && lastItem.type === "text") {
          // Append to existing text item
          lastItem.text += delta.textDelta;
        } else {
          // Create new text item
          assistantContent.push({
            type: "text",
            text: delta.textDelta,
          });
        }
      } else if (delta.type === "tool-call") {
        // Handle tool calls - add them as they come in to maintain order
        assistantContent.push({
          type: "tool-call",
          toolCallId: delta.toolCallId,
          toolName: delta.toolName,
          args: delta.args,
        });

        // Check if done tool was called - if so, don't recur
        if (delta.toolName === "done") {
          shouldRecur = false;
        } else {
          // For other tools, continue recursing
          shouldRecur = true;
        }
      } else if (delta.type === "tool-result") {
        toolResultMessages.push({
          visibility: "internal",
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: delta.toolCallId,
              toolName: delta.toolName,
              result: delta.result,
            },
          ],
        });
      }
    }

    const usage = await result.usage;

    const cost = await calculateModelCost(
      "google:gemini-2.5-pro",
      usage.promptTokens,
      usage.completionTokens,
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
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          inputCost: cost?.inputCost ?? 0,
          outputCost: cost?.outputCost ?? 0,
          totalCost: cost?.totalCost ?? 0,
          inputTokensPrice: cost?.inputTokensPrice ?? 0,
          outputTokensPrice: cost?.outputTokensPrice ?? 0,
          inputImagesPrice: cost?.inputImagesPrice ?? null,
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

  const streamWriter = global.sseConnections?.get(
    context.get("version").chatId,
  );

  if (!streamWriter) {
    throw new Error("Stream writer not found");
  }

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
      await streamWriter.write({
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
