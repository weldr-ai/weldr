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
import {
  type Declaration,
  getExecutionPlan,
} from "@/ai/utils/get-execution-plan";
import { getMessages } from "@/ai/utils/get-messages";
import { insertMessages } from "@/ai/utils/insert-messages";
import { registry } from "@/ai/utils/registry";
import { Logger } from "@/lib/logger";
import type { WorkflowContext } from "@/workflow/context";
import { db, eq } from "@weldr/db";
import { declarations, versions } from "@weldr/db/schema";
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

async function executeDeclarationCoder({
  context,
  declaration,
  progress,
  coolDownPeriod = 1000,
}: {
  context: WorkflowContext;
  declaration: Declaration;
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

  // Create contextual logger with base tags and extras
  const logger = Logger.get({
    tags: ["executeDeclarationCoder"],
    extra: {
      projectId: project.id,
      versionId: version.id,
      declarationId: declaration.id,
    },
  });

  const loopChatId = declaration.chatId;

  if (!loopChatId) {
    throw new Error("Declaration chat ID not found");
  }

  const streamWriter = global.sseConnections?.get(
    context.get("version").chatId,
  );

  if (!streamWriter) {
    throw new Error("Stream writer not found");
  }

  logger.info("Starting declaration coder");

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
      `Starting coder agent iteration ${iterationCount} for declaration ${declaration.id}`,
    );

    shouldContinue = await executeCoderLoop();

    logger.info(
      `Coder agent iteration ${iterationCount} completed for declaration ${declaration.id}`,
      {
        extra: { shouldContinue },
      },
    );

    if (shouldContinue) {
      logger.info(`Recurring in ${coolDownPeriod}ms...`);
      await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));
    }
  }

  logger.info(`Coder agent completed for declaration ${declaration.id}`);
}

export async function coderAgent({
  context,
  coolDownPeriod = 1000,
}: {
  context: WorkflowContext;
  coolDownPeriod?: number;
}) {
  const project = context.get("project");
  const version = context.get("version");
  const user = context.get("user");

  // Create contextual logger with base tags and extras
  const logger = Logger.get({
    tags: ["coderAgent"],
    extra: {
      projectId: project.id,
      versionId: version.id,
    },
  });

  const streamWriter = global.sseConnections?.get(
    context.get("version").chatId,
  );
  if (!streamWriter) {
    throw new Error("Stream writer not found");
  }

  logger.info("Starting coder agent");

  const executionPlan = await getExecutionPlan({ projectId: project.id });

  logger.info(
    `Execution plan retrieved with ${executionPlan.length} declarations.`,
  );

  const progress: Map<
    string,
    {
      summary: string;
      progress: "pending" | "in_progress" | "completed";
    }
  > = new Map();

  for (const declaration of executionPlan) {
    logger.info(
      `Executing coder for declaration: ${declaration.data?.name ?? declaration.uri}`,
    );

    const loopChatId = declaration.chatId;

    if (!loopChatId) {
      throw new Error("Declaration chat ID not found");
    }

    await db
      .update(declarations)
      .set({ progress: "in_progress" })
      .where(eq(declarations.id, declaration.id));

    const taskContext = `Your current task is to implement the following declaration:
    ---
    ${formatTaskDeclarationToMarkdown(declaration)}
    ---
    Note:
    - You can implement any utility functions, components, or other declarations you need to implement the declaration.
    - Read the files you need and implement the required changes.`;

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

    await executeDeclarationCoder({
      context,
      declaration,
      progress,
      coolDownPeriod,
    });

    logger.info(
      `Updating declaration ${declaration.id} progress to 'completed'.`,
    );

    await db
      .update(declarations)
      .set({ progress: "completed" })
      .where(eq(declarations.id, declaration.id));

    progress.set(declaration.id, {
      summary: declaration.implementationDetails?.summary ?? "",
      progress: "completed",
    });
  }

  logger.info(
    "All declarations processed. Updating version progress to 'completed'.",
  );
  await db
    .update(versions)
    .set({ status: "completed" })
    .where(eq(versions.id, version.id));

  logger.info("Coder agent completed");

  // End the stream
  await streamWriter.write({ type: "end" });
}
