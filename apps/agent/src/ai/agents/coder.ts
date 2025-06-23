import {
  deleteFileTool,
  doneTool,
  editFileTool,
  findTool,
  fzfTool,
  grepTool,
  listDirTool,
  readFileTool,
  writeFileTool,
} from "@/ai/tools";
import { getMessages } from "@/ai/utils/get-messages";
import { insertMessages } from "@/ai/utils/insert-messages";
import { registry } from "@/ai/utils/registry";
import { Logger } from "@/lib/logger";
import type { WorkflowContext } from "@/workflow/context";
import { and, db, eq, inArray } from "@weldr/db";
import { versionDeclarations, versionFiles } from "@weldr/db/schema";
import type {
  addMessageItemSchema,
  assistantMessageContentSchema,
} from "@weldr/shared/validators/chats";
import type { declarationSpecsSchema } from "@weldr/shared/validators/declarations/index";
import { streamText } from "ai";
import type { z } from "zod";
import { prompts } from "../prompts";
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
  const user = context.get("user");
  const isXML = context.get("isXML");

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

  await db.transaction(async (tx) => {
    logger.info("Starting coder agent");

    const deletedDeclarations: string[] = [];

    const availableFiles = await tx.query.versionFiles.findMany({
      where: eq(versionFiles.versionId, version.id),
      columns: {
        fileId: false,
        versionId: false,
      },
      with: {
        file: {
          columns: {
            id: true,
            path: true,
          },
          with: {
            declarations: {
              columns: {
                id: true,
                name: true,
                specs: true,
              },
              with: {
                dependencies: {
                  with: {
                    dependency: {
                      columns: {
                        specs: true,
                      },
                      with: {
                        file: {
                          columns: {
                            path: true,
                          },
                        },
                      },
                    },
                  },
                },
                dependents: {
                  with: {
                    dependent: {
                      columns: {
                        specs: true,
                      },
                      with: {
                        file: {
                          columns: {
                            path: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const flatFiles = availableFiles.map((v) => ({
      id: v.file.id,
      path: v.file.path,
      declarations: v.file.declarations.map((d) => ({
        id: d.id,
        specs: d.specs as z.infer<typeof declarationSpecsSchema>,
        dependencies: d.dependencies.map((d) => ({
          dependency: {
            file: {
              path: d.dependency.file.path,
            },
            specs: d.dependency.specs as z.infer<typeof declarationSpecsSchema>,
          },
        })),
        dependents: d.dependents.map((d) => ({
          dependent: {
            file: {
              path: d.dependent.file.path,
            },
            specs: d.dependent.specs as z.infer<typeof declarationSpecsSchema>,
          },
        })),
      })),
    }));

    const totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    const xmlProvider = new XMLProvider(
      [
        listDirTool.getXML(),
        readFileTool.getXML(),
        writeFileTool.getXML(),
        deleteFileTool.getXML(),
        editFileTool.getXML(),
        fzfTool.getXML(),
        grepTool.getXML(),
        findTool.getXML(),
        doneTool.getXML(),
      ],
      context,
    );

    const system = isXML
      ? await prompts.generalCoder(project, xmlProvider.getSpecsMarkdown())
      : await prompts.generalCoder(project);

    // Local function to execute coder agent and handle tool calls
    const executeCoderAgent = async (): Promise<boolean> => {
      let shouldRecur = false;
      const promptMessages = await getMessages(version.chatId);

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
          if (delta.toolName === "delete_file") {
            const result = delta.result;
            if (result.success) {
              const fileResult = flatFiles.find(
                (f) => f.path === result.filePath,
              );
              if (fileResult) {
                deletedDeclarations.push(
                  ...fileResult.declarations.map((d) => d.id),
                );
              }
            }
          }
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
      totalUsage.promptTokens += usage.promptTokens;
      totalUsage.completionTokens += usage.completionTokens;
      totalUsage.totalTokens += usage.totalTokens;

      // Add assistant message - all coder activities are internal
      if (assistantContent.length > 0) {
        messagesToSave.push({
          visibility: "internal",
          role: "assistant",
          content: assistantContent,
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
      logger.info(`Starting coder agent iteration ${iterationCount}`);

      shouldContinue = await executeCoderAgent();

      logger.info(`Coder agent iteration ${iterationCount} completed`, {
        extra: { shouldContinue },
      });

      if (shouldContinue) {
        logger.info(`Recurring in ${coolDownPeriod}ms...`);
        await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));
      }
    }

    logger.info("Coder agent completed");

    logger.info(
      `Usage Prompt: ${totalUsage.promptTokens} Completion: ${totalUsage.completionTokens} Total: ${totalUsage.totalTokens}`,
    );

    await tx
      .delete(versionDeclarations)
      .where(
        and(
          inArray(versionDeclarations.declarationId, deletedDeclarations),
          eq(versionDeclarations.versionId, version.id),
        ),
      );
  });

  // End the stream
  await streamWriter.write({ type: "end" });
}
