import type { AgentRuntimeContext } from "@/mastra";
import { coderAgent } from "@/mastra/agents/coder";
import { createStep } from "@mastra/core";
import type { RuntimeContext } from "@mastra/core/runtime-context";
import { and, db, eq, inArray } from "@weldr/db";
import {
  files,
  versionDeclarations,
  versionFiles,
  versions,
} from "@weldr/db/schema";
import type { declarationSpecsSchema } from "@weldr/shared/validators/declarations/index";
import type { CoreMessage } from "ai";
import { z } from "zod";
import { applyEdits, getEdits } from "./processor";
import type { EditResults } from "./types";
import { checkTypes, commit, formatAndLint } from "./utils";

const codeStepInputSchema = z.object({
  commitMessage: z.string(),
  description: z.string(),
  messages: z.array(z.any()),
});

export const codeStep = createStep({
  id: "code-step",
  description: "Coding step",
  inputSchema: codeStepInputSchema,
  outputSchema: z.void(),
  execute: async ({
    inputData,
    runtimeContext,
  }: {
    inputData: z.infer<typeof codeStepInputSchema>;
    runtimeContext: RuntimeContext<AgentRuntimeContext>;
  }) => {
    const project = runtimeContext.get("project");
    const version = runtimeContext.get("version");
    const user = runtimeContext.get("user");

    const { commitMessage, description, messages } = inputData;

    await db.transaction(async (tx) => {
      console.log(`[coder:${project.id}] Starting coder agent`);
      const currentMessages: CoreMessage[] = [
        ...messages,
        {
          role: "user",
          content: `You are working on the following version:
          Commit message: ${commitMessage}
          Description: ${description}`,
        },
      ];

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
              specs: d.dependency.specs as z.infer<
                typeof declarationSpecsSchema
              >,
            },
          })),
          dependents: d.dependents.map((d) => ({
            dependent: {
              file: {
                path: d.dependent.file.path,
              },
              specs: d.dependent.specs as z.infer<
                typeof declarationSpecsSchema
              >,
            },
          })),
        })),
      }));

      const totalUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      async function generate() {
        await coderAgent.stream(currentMessages, {
          onStepFinish: async ({ text, finishReason, toolResults }) => {
            if (finishReason === "tool-calls") {
              console.log(
                `[coder:${project.id}]: Invoking tools: ${toolResults
                  .map((t) => t.toolName)
                  .join(", ")}`,
              );

              // Add assistant message with tool calls
              currentMessages.push({
                role: "assistant",
                content: text,
              });

              // Add tool results as user messages
              for (const toolResult of toolResults) {
                switch (toolResult.toolName) {
                  case "listFiles": {
                    console.log(
                      `[coder:${project.id}] executing \`listFiles\` tool`,
                    );
                    if (toolResult.result.files) {
                      currentMessages.push({
                        role: "user",
                        content: toolResult.result.files,
                      });
                    }

                    if (toolResult.result.error) {
                      currentMessages.push({
                        role: "user",
                        content: `Failed to list files: ${toolResult.result.error}`,
                      });
                    }

                    console.log(
                      `[coder:${project.id}] \`listFiles\` tool executed`,
                    );
                    break;
                  }
                  case "readFiles": {
                    console.log(
                      `[coder:${project.id}] executing \`readFiles\` tool`,
                    );

                    // const files = flatFiles.filter((file) =>
                    //   toolResult.args.files.includes(file.path),
                    // );

                    // const fileContext = getFilesContext({
                    //   files,
                    // });

                    if (toolResult.result.fileContents) {
                      currentMessages.push({
                        role: "user",
                        content: `${Object.entries(
                          toolResult.result.fileContents,
                        )
                          .map(
                            ([path, content]) =>
                              `${path}\n\`\`\`\n${content}\`\`\``,
                          )
                          .join("\n\n")}`,
                      });
                    }

                    if (toolResult.result.error) {
                      currentMessages.push({
                        role: "user",
                        content: `Failed to read files: ${toolResult.result.error}`,
                      });
                    }

                    console.log(
                      `[coder:${project.id}] \`readFiles\` tool executed`,
                    );
                    break;
                  }
                  case "deleteFiles": {
                    console.log(
                      `[coder:${project.id}] executing \`deleteFiles\` tool`,
                    );

                    if (toolResult.result.filesDeleted) {
                      for (const file of toolResult.result.filesDeleted) {
                        const fileResult = flatFiles.find(
                          (f) => f.path === file,
                        );

                        if (!fileResult) {
                          throw new Error(
                            `deleteFiles: File not found: ${file}`,
                          );
                        }

                        deletedDeclarations.push(
                          ...fileResult.declarations.map((d) => d.id),
                        );
                      }

                      currentMessages.push({
                        role: "user",
                        content: `Finished deleting the following files: ${toolResult.result.filesDeleted.join(", ")}`,
                      });
                    }

                    if (toolResult.result.error) {
                      currentMessages.push({
                        role: "user",
                        content: `Failed to delete files: ${toolResult.result.error}`,
                      });
                    }

                    console.log(
                      `[coder:${project.id}] \`deleteFiles\` tool executed`,
                    );
                    break;
                  }
                  case "installPackages": {
                    console.log(
                      `[coder:${project.id}] executing \`installPackages\` tool`,
                    );

                    if (Array.isArray(toolResult.result)) {
                      currentMessages.push({
                        role: "user",
                        content: `${toolResult.result
                          .map((p) => {
                            if (p.success) {
                              return `${p.package?.name}@${p.package?.version}`;
                            }
                            return `Failed to install ${p.package?.name}: ${p.error}`;
                          })
                          .join(", ")}`,
                      });
                    } else {
                      currentMessages.push({
                        role: "user",
                        content: `Failed to install packages: ${toolResult.result.error}`,
                      });
                    }

                    console.log(
                      `[coder:${project.id}] \`installPackages\` tool executed`,
                    );
                    break;
                  }
                  case "removePackages": {
                    console.log(
                      `[coder:${project.id}] executing \`removePackages\` tool`,
                    );

                    if (toolResult.result) {
                      currentMessages.push({
                        role: "user",
                        content: `Finished removing the following packages: ${toolResult.result.map((p: { name: string }) => p.name).join(", ")}`,
                      });
                    }

                    if (toolResult.result.error) {
                      currentMessages.push({
                        role: "user",
                        content: `Failed to remove packages: ${toolResult.result.error}`,
                      });
                    }

                    console.log(
                      `[coder:${project.id}] \`removePackages\` tool executed`,
                    );
                    break;
                  }
                  default: {
                    console.log(`[coder:${project.id}] Unknown tool call`);
                    break;
                  }
                }
              }
              await generate();
            }
          },
          onFinish: async ({ text, finishReason, usage }) => {
            if (finishReason === "length") {
              console.log(
                `[coder:${project.id}]: Reached max tokens retrying...`,
              );
              currentMessages.push({
                role: "assistant",
                content: text,
              });
              await generate();
            } else if (finishReason === "error") {
              console.log(
                `[coder:${project.id}] Error: ${JSON.stringify(response)}`,
              );
              throw new Error(
                `[coder:${project.id}] Error: ${JSON.stringify(response)}`,
              );
            } else {
              console.log(
                `[coder:${project.id}] Finished with ${finishReason}`,
              );
            }

            totalUsage.promptTokens += usage.promptTokens;
            totalUsage.completionTokens += usage.completionTokens;
            totalUsage.totalTokens += usage.totalTokens;
          },
          onError: (error) => {
            console.log(
              `[coder:${project.id}] Error: ${JSON.stringify(error, null, 2)}`,
            );
            throw error;
          },
          onChunk: ({ chunk }) => {
            if (chunk.type === "text-delta") {
              response += chunk.textDelta;
            }
          },
        });
      }

      // Process all edits at once
      const edits = getEdits({ content: response });

      console.log(`[coder:${project.id}] Edits: ${JSON.stringify(edits)}`);

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

      let retryCount = 0;
      let currentFailedEdits = finalResult.failed || [];

      while (currentFailedEdits.length > 0 && retryCount < 10) {
        retryCount++;

        console.log(
          `[coder:${project.id}] Retry attempt ${retryCount} for failed edits Passed: ${finalResult.passed?.length} Failed: ${currentFailedEdits.length}`,
        );

        // Add failed edits info to messages
        const failureDetails = currentFailedEdits
          .map((f) => `Failed to edit ${f.edit.path}:\n${f.error}`)
          .join("\n\n");

        console.log(`[coder:${project.id}] Failure details: ${failureDetails}`);

        currentMessages.push({
          role: "assistant",
          content: response,
        });

        currentMessages.push({
          role: "user",
          content: `Some edits failed. Please fix the following issues and try again:
        ${failureDetails}

        Please, returned the fixed files only.
        Important: You MUST NOT rewrite the files that passed.`,
        });

        response = "";

        // Generate new response
        await generate();

        // Update our failed edits for next iteration
        currentFailedEdits = finalResult.failed || [];
      }

      console.log(
        `[coder:${project.id}] Coder agent completed Passed: ${finalResult.passed?.length} Failed: ${finalResult.failed?.length}`,
      );

      console.log(
        `[coder:${project.id}] Final passed edits`,
        finalResult.passed?.map((f) => f.path),
      );

      console.log(
        `[coder:${project.id}] Final failed edits`,
        finalResult.failed?.map((f) => f.edit.path),
      );

      // Check types
      const { success: isTypesOk, error: errorTypes } = await checkTypes({
        projectId: project.id,
      });

      if (!isTypesOk) {
        console.log(
          `[coder:${project.id}] Failed to check types: ${errorTypes}`,
        );
        currentMessages.push({
          role: "user",
          content: `Failed to check types: ${errorTypes}`,
        });
        await generate();
      }

      // Format and lint
      const { success: isFormatAndLintOk, error: errorFormatAndLint } =
        await formatAndLint({
          projectId: project.id,
        });

      if (!isFormatAndLintOk) {
        console.log(
          `[coder:${project.id}] Failed to format and lint: ${errorFormatAndLint}`,
        );
        currentMessages.push({
          role: "user",
          content: `Failed to format and lint the project: ${errorFormatAndLint}`,
        });
        await generate();
      }

      // Commit
      const { success: isCommitOk, error: errorCommit } = await commit({
        projectId: project.id,
        name: user.name,
        email: user.email,
        commitMessage,
      });

      if (!isCommitOk) {
        console.log(`[coder:${project.id}] Failed to commit: ${errorCommit}`);
        throw new Error(
          `[coder:${project.id}] Failed to commit: ${errorCommit}`,
        );
      }

      console.log(
        `[coder:${project.id}] Usage Prompt: ${totalUsage.promptTokens} Completion: ${totalUsage.completionTokens} Total: ${totalUsage.totalTokens}`,
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
  },
});
