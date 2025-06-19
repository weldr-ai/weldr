import { prompts } from "@/ai/prompts";
import {
  deleteFilesTool,
  listFilesTool,
  readFilesTool,
} from "@/ai/tools/files";
import { installPackagesTool, removePackagesTool } from "@/ai/tools/packages";
import { getMessages } from "@/ai/utils/get-messages";
import { insertMessages } from "@/ai/utils/insert-messages";
import { saveResponseMessages } from "@/ai/utils/save-response-messages";
import { registry } from "@/lib/registry";
import type { WorkflowContext } from "@/workflow/context";
import { and, db, eq, inArray } from "@weldr/db";
import {
  files,
  versionDeclarations,
  versionFiles,
  versions,
} from "@weldr/db/schema";
import type { declarationSpecsSchema } from "@weldr/shared/validators/declarations/index";
import { streamText } from "ai";
import type { z } from "zod";
import { applyEdits, getEdits } from "./processor";
import type { EditResults } from "./types";
import { checkTypes, commit, formatAndLint } from "./utils";

export async function coderAgent({
  context,
  coolDownPeriod = 5000,
}: {
  context: WorkflowContext;
  coolDownPeriod?: number;
}) {
  const project = context.get("project");
  const version = context.get("version");
  const user = context.get("user");

  await db.transaction(async (tx) => {
    console.log(`[codeAgent:${project.id}] Starting coder agent`);
    const deletedDeclarations: string[] = [];

    let response = "";
    const finalResult: EditResults = {};

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

    const filePaths = availableFiles.map(
      (versionFile) => versionFile.file.path,
    );

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
        system: await prompts.generalCoder(project, "diff-fenced"),
        model: registry.languageModel("google:gemini-2.5-pro"),
        messages: promptMessages,
        tools: {
          listFiles: listFilesTool(context),
          readFiles: readFilesTool(context),
          deleteFiles: deleteFilesTool(context),
          installPackages: installPackagesTool(context),
          removePackages: removePackagesTool(context),
        },
        onFinish: async ({ response, toolResults, finishReason }) => {
          const messages = response.messages;
          await saveResponseMessages({
            type: "internal",
            chatId: version.chatId,
            userId: user.id,
            messages,
          });
          switch (finishReason) {
            case "tool-calls": {
              console.log(
                `[codeAgent:${project.id}]: Invoking tools: ${toolResults
                  .map((t) => t.toolName)
                  .join(", ")}`,
              );
              for (const toolResult of toolResults) {
                switch (toolResult.toolName) {
                  case "deleteFiles": {
                    if (toolResult.result.success) {
                      for (const file of toolResult.result.filesDeleted) {
                        const fileResult = flatFiles.find(
                          (f) => f.path === file,
                        );
                        if (fileResult) {
                          deletedDeclarations.push(
                            ...fileResult.declarations.map((d) => d.id),
                          );
                        }
                      }
                    }
                    break;
                  }
                }
              }
              shouldRecur = true;
              break;
            }
            case "length": {
              console.log(
                `[codeAgent:onFinish:${project.id}]: Reached max tokens retrying...`,
              );
              shouldRecur = true;
              break;
            }
            case "error": {
              console.log(
                `[codeAgent:${project.id}] Error: ${JSON.stringify(response, null, 2)}`,
              );
              throw new Error(
                `[codeAgent:${project.id}] Error: ${JSON.stringify(response, null, 2)}`,
              );
            }
          }
        },
        onError: (error) => {
          console.log(
            `[codeAgent:${project.id}] Error: ${JSON.stringify(error, null, 2)}`,
          );
          throw error;
        },
      });

      try {
        for await (const chunk of result.textStream) {
          console.log(`[codeAgent:${project.id}] Chunk: ${chunk}`);
          response += chunk;
        }
      } catch (error) {
        console.error(
          `[codeAgent:error:${project.id}] ${JSON.stringify(error, null, 2)}`,
        );
        throw error;
      }

      // Process all edits at once only if we're not recurring
      if (!shouldRecur) {
        const edits = getEdits({ content: response });

        console.log(
          `[codeAgent:${project.id}] Edits: ${JSON.stringify(edits)}`,
        );

        // Apply the edits
        if (edits.length > 0) {
          const results = await applyEdits({
            existingFiles: filePaths,
            edits,
            projectId: project.id,
          });

          if (results.passed) {
            finalResult.passed = [
              ...(finalResult.passed || []),
              ...results.passed,
            ];
          }

          if (results.failed) {
            finalResult.failed = [
              ...(finalResult.failed || []),
              ...results.failed,
            ];
          }
        }
      }

      return shouldRecur;
    };

    // Main execution loop for the coder agent
    let shouldContinue = true;
    while (shouldContinue) {
      shouldContinue = await executeCoderAgent();
      if (shouldContinue) {
        console.log(
          `[codeAgent:${project.id}] Waiting for ${coolDownPeriod}ms before retrying...`,
        );
        await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));
      }
    }

    let retryCount = 0;
    let currentFailedEdits = finalResult.failed || [];

    while (currentFailedEdits.length > 0 && retryCount < 10) {
      retryCount++;

      console.log(
        `[codeAgent:${project.id}] Retry attempt ${retryCount} for failed edits Passed: ${finalResult.passed?.length} Failed: ${currentFailedEdits.length}`,
      );

      // Add failed edits info to messages
      const failureDetails = currentFailedEdits
        .map((f) => `Failed to edit ${f.edit.path}:\n${f.error}`)
        .join("\n\n");

      console.log(
        `[codeAgent:${project.id}] Failure details: ${failureDetails}`,
      );

      await insertMessages({
        input: {
          chatId: version.chatId,
          userId: user.id,
          messages: [
            {
              type: "internal",
              role: "assistant",
              content: [{ type: "text", text: response }],
              createdAt: new Date(),
            },
            {
              type: "internal",
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Some edits failed. Please fix the following issues and try again:
              ${failureDetails}

              Please, returned the fixed files only.
              Important: You MUST NOT rewrite the files that passed.`,
                },
              ],
              createdAt: new Date(),
            },
          ],
        },
      });

      response = "";

      // Generate new response
      await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));

      // Retry with the same loop pattern
      let shouldContinue = true;
      while (shouldContinue) {
        shouldContinue = await executeCoderAgent();
        if (shouldContinue) {
          console.log(
            `[codeAgent:${project.id}] Recurring in ${coolDownPeriod / 1000}s...`,
          );
          await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));
        }
      }

      // Update our failed edits for next iteration
      currentFailedEdits = finalResult.failed || [];
    }

    console.log(
      `[codeAgent:${project.id}] Coder agent completed Passed: ${finalResult.passed?.length} Failed: ${finalResult.failed?.length}`,
    );

    console.log(
      `[codeAgent:${project.id}] Final passed edits`,
      finalResult.passed?.map((f) => f.path),
    );

    console.log(
      `[codeAgent:${project.id}] Final failed edits`,
      finalResult.failed?.map((f) => f.edit.path),
    );

    // Check types with retry loop
    let typesRetryCount = 0;
    let isTypesOk = false;

    while (!isTypesOk && typesRetryCount < 5) {
      const { success, error: errorTypes } = await checkTypes({
        projectId: project.id,
      });

      isTypesOk = success;

      if (!isTypesOk) {
        typesRetryCount++;
        console.log(
          `[codeAgent:${project.id}] Failed to check types (attempt ${typesRetryCount}): ${errorTypes}`,
        );

        await insertMessages({
          input: {
            chatId: version.chatId,
            userId: user.id,
            messages: [
              {
                type: "internal",
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Failed to check types: ${errorTypes}`,
                  },
                ],
                createdAt: new Date(),
              },
            ],
          },
        });

        await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));

        // Let agent fix the type errors
        let shouldContinue = true;
        while (shouldContinue) {
          shouldContinue = await executeCoderAgent();
          if (shouldContinue) {
            console.log(
              `[codeAgent:${project.id}] Recurring in ${coolDownPeriod / 1000}s...`,
            );
            await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));
          }
        }
      }
    }

    // Format and lint with retry loop
    let formatLintRetryCount = 0;
    let isFormatAndLintOk = false;

    while (!isFormatAndLintOk && formatLintRetryCount < 5) {
      const { success, error: errorFormatAndLint } = await formatAndLint({
        projectId: project.id,
      });

      isFormatAndLintOk = success;

      if (!isFormatAndLintOk) {
        formatLintRetryCount++;
        console.log(
          `[codeAgent:${project.id}] Failed to format and lint (attempt ${formatLintRetryCount}): ${errorFormatAndLint}`,
        );

        await insertMessages({
          input: {
            chatId: version.chatId,
            userId: user.id,
            messages: [
              {
                type: "internal",
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Failed to format and lint the project: ${errorFormatAndLint}`,
                  },
                ],
                createdAt: new Date(),
              },
            ],
          },
        });

        await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));

        // Let agent fix the format and lint errors
        let shouldContinue = true;
        while (shouldContinue) {
          shouldContinue = await executeCoderAgent();
          if (shouldContinue) {
            console.log(
              `[codeAgent:${project.id}] Recurring in ${coolDownPeriod / 1000}s...`,
            );
            await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));
          }
        }
      }
    }

    // Commit
    const { success: isCommitOk, error: errorCommit } = await commit({
      projectId: project.id,
      name: user.name,
      email: user.email,
      commitMessage: version.message as string,
    });

    if (!isCommitOk) {
      console.log(`[codeAgent:${project.id}] Failed to commit: ${errorCommit}`);
      throw new Error(
        `[codeAgent:${project.id}] Failed to commit: ${errorCommit}`,
      );
    }

    console.log(
      `[codeAgent:${project.id}] Usage Prompt: ${totalUsage.promptTokens} Completion: ${totalUsage.completionTokens} Total: ${totalUsage.totalTokens}`,
    );

    await tx
      .delete(versionDeclarations)
      .where(
        and(
          inArray(versionDeclarations.declarationId, deletedDeclarations),
          eq(versionDeclarations.versionId, version.id),
        ),
      );

    for (const file of finalResult.passed || []) {
      let resultFile = await tx.query.files.findFirst({
        where: and(
          eq(
            files.path,
            file.path.startsWith("/") ? file.path : `/${file.path}`,
          ),
          eq(files.projectId, project.id),
        ),
      });

      if (!resultFile) {
        const [newFile] = await tx
          .insert(files)
          .values({
            projectId: project.id,
            path: file.path.startsWith("/") ? file.path : `/${file.path}`,
            userId: user.id,
          })
          .returning();

        if (!newFile) {
          throw new Error(
            `[processFile:${project.id}] Failed to insert file ${file.path}`,
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
        changedFiles: finalResult.passed?.map((f) => f.path) || [],
      })
      .where(eq(versions.id, version.id));
  });
}
