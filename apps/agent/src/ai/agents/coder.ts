import { prompts } from "@/ai/prompts";
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
import {
  files,
  versionDeclarations,
  versionFiles,
  versions,
} from "@weldr/db/schema";
import type {
  addMessageItemSchema,
  assistantMessageContentSchema,
  toolResultPartSchema,
} from "@weldr/shared/validators/chats";
import type { declarationSpecsSchema } from "@weldr/shared/validators/declarations/index";
import { streamText } from "ai";
import type { z } from "zod";

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

  // Get the SSE stream writer from global connections
  const streamWriter = global.sseConnections?.get(version.chatId);

  if (!streamWriter) {
    throw new Error("Stream writer not found");
  }

  await db.transaction(async (tx) => {
    logger.info("Starting coder agent");

    const deletedDeclarations: string[] = [];

    const updatedFiles = new Set<string>();

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

    // Local function to execute coder agent and handle tool calls
    const executeCoderAgent = async (): Promise<boolean> => {
      let shouldRecur = false;
      const promptMessages = await getMessages(version.chatId);

      const result = await streamText({
        model: registry.languageModel("google:gemini-2.5-pro"),
        system: await prompts.generalCoder(project),
        messages: promptMessages,
        tools: {
          listDir: listDirTool(context),
          readFile: readFileTool(context),
          editFile: editFileTool(context),
          deleteFile: deleteFileTool(context),
          fzf: fzfTool(context),
          grep: grepTool(context),
          find: findTool(context),
          writeFile: writeFileTool(context),
          done: doneTool(context),
        },
        onError: (error) => {
          logger.error("Error in coder agent", {
            extra: { error },
          });
        },
      });

      // Tool results
      const toolResults: z.infer<typeof toolResultPartSchema>[] = [];
      // Assistant message content
      const assistantContent: z.infer<typeof assistantMessageContentSchema>[] =
        [];
      // Messages to save
      const messagesToSave: z.infer<typeof addMessageItemSchema>[] = [];

      // Process the stream and handle tool calls
      for await (const delta of result.fullStream) {
        if (delta.type === "text-delta") {
          // Stream text content to SSE
          await streamWriter.write({
            type: "text",
            text: delta.textDelta,
          });

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
          // Handle tool results
          toolResults.push({
            type: "tool-result",
            toolCallId: delta.toolCallId,
            toolName: delta.toolName,
            result: delta.result,
          });

          // Handle tool results
          switch (delta.toolName) {
            case "deleteFile": {
              const toolResult = delta.result;
              if (toolResult.success) {
                const fileResult = flatFiles.find(
                  (f) => f.path === toolResult.filePath,
                );
                if (fileResult) {
                  deletedDeclarations.push(
                    ...fileResult.declarations.map((d) => d.id),
                  );
                }
              }
              break;
            }
          }
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

      // Add tool results as separate tool messages - all internal
      if (toolResults.length > 0) {
        messagesToSave.push({
          visibility: "internal",
          role: "tool",
          content: toolResults,
        });
      }

      // Store messages if any
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

    logger.info("Final updated files");

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

    for (const file of updatedFiles) {
      let resultFile = await tx.query.files.findFirst({
        where: and(
          eq(files.path, file.startsWith("/") ? file : `/${file}`),
          eq(files.projectId, project.id),
        ),
      });

      if (!resultFile) {
        const [newFile] = await tx
          .insert(files)
          .values({
            projectId: project.id,
            path: file.startsWith("/") ? file : `/${file}`,
            userId: user.id,
          })
          .returning();

        if (!newFile) {
          throw new Error(
            `[processFile:${project.id}] Failed to insert file ${file}`,
          );
        }

        resultFile = newFile;
      }

      // Add the file to the version
      await tx
        .insert(versionFiles)
        .values({
          versionId: version.id,
          fileId: resultFile.id,
        })
        .onConflictDoNothing();
    }

    await tx
      .update(versions)
      .set({
        progress: "coded",
        changedFiles: Array.from(updatedFiles),
      })
      .where(eq(versions.id, version.id));
  });

  // End the stream
  await streamWriter.write({ type: "end" });
}
