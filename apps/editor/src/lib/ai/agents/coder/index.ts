import "server-only";

import { prompts } from "@/lib/ai/prompts";
import { registry } from "@/lib/ai/registry";
import {
  deleteFilesTool,
  executeDeleteFilesTool,
  executeListFilesTool,
  executeReadFilesTool,
  listFilesTool,
  readFilesTool,
} from "@/lib/ai/tools/files";
import {
  executeInstallPackagesTool,
  executeRemovePackagesTool,
  installPackagesTool,
  removePackagesTool,
} from "@/lib/ai/tools/packages";
import type { TStreamableValue } from "@/types";
import type { User } from "@weldr/auth";
import { and, db, eq, inArray } from "@weldr/db";
import {
  files,
  packages,
  versionDeclarations,
  versionFiles,
  versions,
} from "@weldr/db/schema";
import type { declarationSpecsSchema } from "@weldr/shared/validators/declarations/index";
import { type CoreMessage, streamText } from "ai";
import type { z } from "zod";
import { applyEdits, getEdits } from "./editor";
import type { EditResults } from "./types";
import { checkTypes, commit, formatAndLint } from "./utils";

export async function coder({
  streamWriter,
  user,
  projectContext,
  projectId,
  version,
  machineId,
  promptMessages,
  args,
}: {
  streamWriter: WritableStreamDefaultWriter<TStreamableValue>;
  user: User;
  projectContext: string;
  projectId: string;
  version: typeof versions.$inferSelect;
  machineId: string;
  promptMessages: CoreMessage[];
  args: {
    commitMessage: string;
    description: string;
  };
}) {
  return await db.transaction(async (tx) => {
    console.log(`[coder:${projectId}] Starting coder agent`);

    const currentMessages: CoreMessage[] = [
      ...promptMessages,
      {
        role: "user",
        content: `You are working on the following version:
        Commit message: ${args.commitMessage}
        Description: ${args.description}`,
      },
    ];

    const installedPackages = await tx.query.packages.findMany({
      where: eq(packages.projectId, projectId),
      columns: {
        id: true,
        name: true,
        description: true,
        type: true,
      },
    });

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

    async function generate() {
      const result = streamText({
        model: registry.languageModel("anthropic:claude-3-5-sonnet-latest"),
        system: prompts.generalCoder(projectContext),
        messages: currentMessages,
        tools: {
          listFiles: listFilesTool,
          readFiles: readFilesTool,
          deleteFiles: deleteFilesTool,
          installPackages: installPackagesTool,
          removePackages: removePackagesTool,
        },
        onFinish: async ({ text, finishReason, toolCalls, usage }) => {
          if (finishReason === "length") {
            console.log(`[coder:${projectId}]: Reached max tokens retrying...`);
            currentMessages.push({
              role: "assistant",
              content: text,
            });
            await generate();
          } else if (finishReason === "tool-calls") {
            console.log(
              `[coder:${projectId}]: Invoking tools: ${toolCalls
                .map((t) => t.toolName)
                .join(", ")}`,
            );

            // Add assistant message with tool calls
            currentMessages.push({
              role: "assistant",
              content: text,
            });

            // Add tool results as user messages
            for (const toolCall of toolCalls) {
              switch (toolCall.toolName) {
                case "listFiles": {
                  console.log(
                    `[coder:${projectId}] executing \`listFiles\` tool`,
                  );
                  const executeResult = await executeListFilesTool({
                    projectId,
                    machineId,
                  });

                  if (executeResult.files) {
                    currentMessages.push({
                      role: "user",
                      content: executeResult.files,
                    });
                  }

                  if (executeResult.error) {
                    currentMessages.push({
                      role: "user",
                      content: `Failed to list files: ${executeResult.error}`,
                    });
                  }

                  console.log(
                    `[coder:${projectId}] \`listFiles\` tool executed`,
                  );
                  break;
                }
                case "readFiles": {
                  console.log(
                    `[coder:${projectId}] executing \`readFiles\` tool`,
                  );

                  // const files = flatFiles.filter((file) =>
                  //   toolResult.args.files.includes(file.path),
                  // );

                  // const fileContext = getFilesContext({
                  //   files,
                  // });

                  const executeResult = await executeReadFilesTool({
                    projectId,
                    machineId,
                    args: toolCall.args,
                  });

                  if (executeResult.fileContents) {
                    currentMessages.push({
                      role: "user",
                      content: `${Object.entries(executeResult.fileContents)
                        .map(
                          ([path, content]) =>
                            `${path}\n\`\`\`\n${content}\`\`\``,
                        )
                        .join("\n\n")}`,
                    });
                  }

                  if (executeResult.error) {
                    currentMessages.push({
                      role: "user",
                      content: `Failed to read files: ${executeResult.error}`,
                    });
                  }

                  console.log(
                    `[coder:${projectId}] \`readFiles\` tool executed`,
                  );
                  break;
                }
                case "deleteFiles": {
                  console.log(
                    `[coder:${projectId}] executing \`deleteFiles\` tool`,
                  );

                  const executeResult = await executeDeleteFilesTool({
                    projectId,
                    versionId: version.id,
                    existingFiles: flatFiles,
                    tx,
                    machineId,
                    args: toolCall.args,
                  });

                  if (executeResult.filesDeleted) {
                    for (const file of executeResult.filesDeleted) {
                      const fileResult = flatFiles.find((f) => f.path === file);

                      if (!fileResult) {
                        throw new Error(`deleteFiles: File not found: ${file}`);
                      }

                      deletedDeclarations.push(
                        ...fileResult.declarations.map((d) => d.id),
                      );
                    }

                    currentMessages.push({
                      role: "user",
                      content: `Finished deleting the following files: ${toolCall.args.files.join(", ")}`,
                    });
                  }

                  if (executeResult.error) {
                    currentMessages.push({
                      role: "user",
                      content: `Failed to delete files: ${executeResult.error}`,
                    });
                  }

                  console.log(
                    `[coder:${projectId}] \`deleteFiles\` tool executed`,
                  );
                  break;
                }
                case "installPackages": {
                  console.log(
                    `[coder:${projectId}] executing \`installPackages\` tool`,
                  );

                  const executeResult = await executeInstallPackagesTool({
                    projectId,
                    versionId: version.id,
                    tx,
                    machineId,
                    args: toolCall.args,
                  });

                  if (Array.isArray(executeResult)) {
                    currentMessages.push({
                      role: "user",
                      content: `${executeResult
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
                      content: `Failed to install packages: ${executeResult.error}`,
                    });
                  }

                  console.log(
                    `[coder:${projectId}] \`installPackages\` tool executed`,
                  );
                  break;
                }
                case "removePackages": {
                  console.log(
                    `[coder:${projectId}] executing \`removePackages\` tool`,
                  );

                  const executeResult = await executeRemovePackagesTool({
                    projectId,
                    versionId: version.id,
                    installedPackages,
                    tx,
                    machineId,
                    args: toolCall.args,
                  });

                  if (executeResult.packages) {
                    currentMessages.push({
                      role: "user",
                      content: `Finished removing the following packages: ${executeResult.packages.map((p) => p.name).join(", ")}`,
                    });
                  }

                  if (executeResult.error) {
                    currentMessages.push({
                      role: "user",
                      content: `Failed to remove packages: ${executeResult.error}`,
                    });
                  }

                  console.log(
                    `[coder:${projectId}] \`removePackages\` tool executed`,
                  );
                  break;
                }
                default: {
                  console.log(`[coder:${projectId}] Unknown tool call`);
                  break;
                }
              }
            }

            await generate();
          } else if (finishReason === "error") {
            console.log(
              `[coder:${projectId}] Error: ${JSON.stringify(response)}`,
            );
            throw new Error(
              `[coder:${projectId}] Error: ${JSON.stringify(response)}`,
            );
          } else {
            console.log(`[coder:${projectId}] Finished with ${finishReason}`);
          }

          totalUsage.promptTokens += usage.promptTokens;
          totalUsage.completionTokens += usage.completionTokens;
          totalUsage.totalTokens += usage.totalTokens;
        },
        onError: (error) => {
          console.log(
            `[coder:${projectId}] Error: ${JSON.stringify(error, null, 2)}`,
          );
          throw error;
        },
      });

      for await (const text of result.textStream) {
        console.log(`[coder:${projectId}] CHUNK: ${text}`);
        response += text;
      }
    }

    await generate();

    // Process all edits at once
    const edits = getEdits({ content: response });

    console.log(`[coder:${projectId}] Edits: ${JSON.stringify(edits)}`);

    // Apply the edits
    if (edits.length > 0) {
      const results = await applyEdits({
        existingFiles: filePaths,
        edits,
        projectId,
        machineId,
      });

      if (results.passed) {
        finalResult.passed = [...(finalResult.passed || []), ...results.passed];
      }

      if (results.failed) {
        finalResult.failed = [...(finalResult.failed || []), ...results.failed];
      }
    }

    let retryCount = 0;
    let currentFailedEdits = finalResult.failed || [];

    while (currentFailedEdits.length > 0 && retryCount < 10) {
      retryCount++;

      console.log(
        `[coder:${projectId}] Retry attempt ${retryCount} for failed edits Passed: ${finalResult.passed?.length} Failed: ${currentFailedEdits.length}`,
      );

      // Add failed edits info to messages
      const failureDetails = currentFailedEdits
        .map((f) => `Failed to edit ${f.edit.path}:\n${f.error}`)
        .join("\n\n");

      console.log(`[coder:${projectId}] Failure details: ${failureDetails}`);

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
      `[coder:${projectId}] Coder agent completed Passed: ${finalResult.passed?.length} Failed: ${finalResult.failed?.length}`,
    );

    console.log(
      `[coder:${projectId}] Final passed edits`,
      finalResult.passed?.map((f) => f.path),
    );

    console.log(
      `[coder:${projectId}] Final failed edits`,
      finalResult.failed?.map((f) => f.edit.path),
    );

    // Check types
    const { success: isTypesOk, error: errorTypes } = await checkTypes({
      projectId,
      machineId,
    });

    if (!isTypesOk) {
      console.log(`[coder:${projectId}] Failed to check types: ${errorTypes}`);
      currentMessages.push({
        role: "user",
        content: `Failed to check types: ${errorTypes}`,
      });

      await generate();
    }

    // Format and lint
    const { success: isFormatAndLintOk, error: errorFormatAndLint } =
      await formatAndLint({
        projectId,
        machineId,
      });

    if (!isFormatAndLintOk) {
      console.log(
        `[coder:${projectId}] Failed to format and lint: ${errorFormatAndLint}`,
      );
      currentMessages.push({
        role: "user",
        content: `Failed to format and lint the project: ${errorFormatAndLint}`,
      });

      await generate();
    }

    // Commit
    const { success: isCommitOk, error: errorCommit } = await commit({
      projectId,
      machineId,
      user,
      commitMessage: args.commitMessage,
    });

    if (!isCommitOk) {
      console.log(`[coder:${projectId}] Failed to commit: ${errorCommit}`);
      throw new Error(`[coder:${projectId}] Failed to commit: ${errorCommit}`);
    }

    console.log(
      `[coder:${projectId}] Usage Prompt: ${totalUsage.promptTokens} Completion: ${totalUsage.completionTokens} Total: ${totalUsage.totalTokens}`,
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
          eq(files.projectId, projectId),
        ),
      });

      if (!resultFile) {
        const [newFile] = await tx
          .insert(files)
          .values({
            projectId,
            path: file.path.startsWith("/") ? file.path : `/${file.path}`,
            userId: user.id,
          })
          .returning();

        if (!newFile) {
          throw new Error(
            `[processFile:${projectId}] Failed to insert file ${file.path}`,
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
