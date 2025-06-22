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
import { ToolSet } from "@/ai/utils/tools";
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

      const toolSet = new ToolSet(context, [
        listDirTool,
        readFileTool,
        editFileTool,
        deleteFileTool,
        fzfTool,
        grepTool,
        findTool,
        writeFileTool,
        doneTool,
      ]);

      // Reset streaming state for new generation
      toolSet.resetStreamingState();

      const result = await streamText({
        model: registry.languageModel("google:gemini-2.5-pro"),
        system: await prompts.generalCoder(project, toolSet.getSpecsMarkdown()),
        messages: promptMessages,
        onError: (error) => {
          logger.error("Error in coder agent", {
            extra: { error },
          });
        },
      });

      let responseText = "";
      let wasInterrupted = false;
      const allSuccesses: Awaited<ReturnType<typeof toolSet.run>>["successes"] =
        [];
      const allErrors: Awaited<ReturnType<typeof toolSet.run>>["errors"] = [];

      // Process streaming chunks and execute tools incrementally
      for await (const chunk of result.textStream) {
        responseText += chunk;

        // Process this chunk for tool calls
        const { newSuccesses, newErrors, hasToolCalls } =
          await toolSet.processStreamingChunk(chunk);

        // Add new results to our collections
        allSuccesses.push(...newSuccesses);
        allErrors.push(...newErrors);

        // Handle new tool executions
        if (newSuccesses.length > 0) {
          logger.info(
            `Executing tools during streaming: ${newSuccesses
              .map((t) => t.name)
              .join(", ")}`,
          );

          for (const success of newSuccesses) {
            if (success.name === "edit_file") {
              updatedFiles.add(success.parameters.targetFile);
            } else if (success.name === "delete_file") {
              const fileResult = flatFiles.find(
                (f) => f.path === success.parameters.filePath,
              );
              if (fileResult) {
                deletedDeclarations.push(
                  ...fileResult.declarations.map((d) => d.id),
                );
              }
            }
          }
        }

        // Handle errors immediately
        if (newErrors.length > 0) {
          logger.info(`Tool errors detected: ${newErrors.length}`);
          await toolSet.handleToolErrors({
            errors: newErrors,
            chatId: version.chatId,
            userId: user.id,
          });
        }

        // Interrupt generation if tool calls were detected
        if (hasToolCalls) {
          logger.info("Tool calls detected, interrupting stream", {
            extra: {
              successCount: newSuccesses.length,
              errorCount: newErrors.length,
            },
          });
          wasInterrupted = true;
          break;
        }
      }

      // Prepare the assistant message content with proper structure
      const assistantContent: z.infer<typeof assistantMessageContentSchema>[] =
        [];

      // Add text content if any
      if (responseText.trim()) {
        assistantContent.push({
          type: "text",
          text: responseText,
        });
      }

      // Add tool calls to the message content
      for (const success of allSuccesses) {
        assistantContent.push({
          type: "tool-call",
          toolName: success.name,
          args: success.parameters as Record<string, unknown>,
        });
      }

      // Save messages using the proper schema structure
      const messagesToSave: z.infer<typeof addMessageItemSchema>[] = [];

      // Add assistant message if there's content
      if (assistantContent.length > 0) {
        messagesToSave.push({
          visibility: "internal",
          role: "assistant",
          content: assistantContent,
        });
      }

      // Add tool results as separate tool messages
      if (allSuccesses.length > 0 || allErrors.length > 0) {
        const toolResults: z.infer<typeof toolResultPartSchema>[] = [
          ...allSuccesses.map((success) => ({
            type: "tool-result" as const,
            toolName: success.name,
            result: success.result,
            isError: false,
          })),
          ...allErrors.map((error) => ({
            type: "tool-result" as const,
            toolName: error.name,
            result: error.error,
            isError: true,
          })),
        ];

        // Determine if the task is done
        const hasDone = toolResults.some(
          (result) => result.toolName === "done",
        );

        if (hasDone) {
          return false;
        }

        messagesToSave.push({
          visibility: "internal",
          role: "tool",
          content: toolResults,
        });
      }

      // Save all messages
      if (messagesToSave.length > 0) {
        await insertMessages({
          input: {
            chatId: version.chatId,
            userId: user.id,
            messages: messagesToSave,
          },
        });
      }

      const finishReason = await result.finishReason;

      // Log debugging information
      logger.info("Checking recursion conditions", {
        extra: {
          wasInterrupted,
          finishReason,
          successCount: allSuccesses.length,
          errorCount: allErrors.length,
        },
      });

      console.log("=== FINISH REASON ===");
      console.log(finishReason);
      console.log("=== END ===");

      // Continue if generation was interrupted by tools or hit length limit
      if (wasInterrupted || finishReason === "length") {
        logger.info("Continuing due to interruption or length limit");
        shouldRecur = true;
      }

      // Continue if we had any tool executions or errors
      if (allSuccesses.length > 0 || allErrors.length > 0) {
        logger.info("Continuing due to tool executions");
        shouldRecur = true;
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
}
