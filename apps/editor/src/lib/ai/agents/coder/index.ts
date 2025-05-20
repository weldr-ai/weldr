import "server-only";

import type { TStreamableValue, VersionStreamableValue } from "@/types";
import { createId } from "@paralleldrive/cuid2";
import { and, db, eq, inArray } from "@weldr/db";
import {
  files,
  packages,
  versionDeclarations,
  versionFiles,
  versionPackages,
  versions,
} from "@weldr/db/schema";
import { S3 } from "@weldr/shared/s3";
import type { declarationSpecsSchema } from "@weldr/shared/validators/declarations/index";
import { type CoreMessage, streamText } from "ai";
import type { z } from "zod";
import { insertMessages } from "../../insert-messages";
import { prompts } from "../../prompts";
import { registry } from "../../registry";
import {
  deleteFilesTool,
  installPackagesTool,
  readFilesTool,
  removePackagesTool,
} from "../../tools";
import { getFilesContext, getFolderStructure } from "./context";
import { applyEdits, findFilename, getEdits } from "./editor";
import { FileCache } from "./file-cache";
import type { EditResults } from "./types";

export async function coder({
  streamWriter,
  userId,
  projectId,
  chatId,
  version,
  promptMessages,
}: {
  streamWriter: WritableStreamDefaultWriter<TStreamableValue>;
  userId: string;
  projectId: string;
  chatId: string;
  version: typeof versions.$inferSelect;
  promptMessages: CoreMessage[];
}) {
  return await db.transaction(async (tx) => {
    console.log(`[coder:${projectId}] Starting coder agent`);

    const currentMessages: CoreMessage[] = [...promptMessages];
    const fileCache = new FileCache();

    const installedPackages = await tx.query.packages.findMany({
      where: eq(packages.projectId, projectId),
      columns: {
        id: true,
        name: true,
        description: true,
        type: true,
      },
    });
    const deletedPackages: string[] = [];
    const deletedDeclarations: string[] = [];
    const deletedFiles: string[] = [];

    let response = "";
    const finalResult: EditResults = {};

    const availableFiles = await tx.query.versionFiles.findMany({
      where: eq(versionFiles.versionId, version.id),
      columns: {
        fileId: false,
        versionId: false,
        s3VersionId: false,
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

    const context = getFolderStructure({
      files: flatFiles,
    });

    const versionMessageId = createId();

    const streamValue: VersionStreamableValue = {
      id: versionMessageId,
      type: "version",
      versionId: version.id,
      versionMessage: version.message,
      versionNumber: version.number,
      versionDescription: version.description,
      changedFiles: [],
    };

    async function generate() {
      const { textStream, usage } = streamText({
        model: registry.languageModel("anthropic:claude-3-5-sonnet-latest"),
        system: prompts.generalCoder(context),
        messages: currentMessages,
        tools: {
          installPackages: installPackagesTool({
            projectId,
            versionId: version.id,
            tx,
          }),
          removePackages: removePackagesTool({
            projectId,
          }),
          readFiles: readFilesTool({
            projectId,
            fileCache,
          }),
          deleteFiles: deleteFilesTool({
            projectId,
          }),
        },
        onFinish: async ({
          finishReason,
          text,
          toolCalls,
          toolResults,
          response,
        }) => {
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

            for (const toolCall of toolCalls) {
              switch (toolCall.toolName) {
                case "readFiles": {
                  const toolResult = toolResults.find(
                    (toolResult) => toolResult.toolName === "readFiles",
                  );

                  if (!toolResult) {
                    throw new Error("readFiles: Tool result not found");
                  }

                  const fileContents = toolResult.result;

                  const files = flatFiles.filter((file) =>
                    toolResult.args.files.includes(file.path),
                  );

                  const fileContext = getFilesContext({
                    files,
                  });

                  currentMessages.push({
                    role: "user",
                    content: `### Files Contents
${Object.entries(fileContents)
  .map(([path, content]) => `${path}\n\`\`\`\n${content}\`\`\``)
  .join("\n\n")}

## Files context
${fileContext}`,
                  });

                  break;
                }
                case "deleteFiles": {
                  const toolCall = toolCalls.find(
                    (toolCall) => toolCall.toolName === "deleteFiles",
                  );

                  if (!toolCall) {
                    throw new Error("deleteFiles: Tool call not found");
                  }

                  for (const file of toolCall.args.files) {
                    const fileResult = flatFiles.find((f) => f.path === file);

                    if (!fileResult) {
                      throw new Error(`deleteFiles: File not found: ${file}`);
                    }

                    deletedDeclarations.push(
                      ...fileResult.declarations.map((d) => d.id),
                    );

                    deletedFiles.push(fileResult.id);
                  }

                  currentMessages.push({
                    role: "user",
                    content: `Finished deleting the following files: ${toolCall.args.files.join(
                      ", ",
                    )}`,
                  });

                  break;
                }
                case "installPackages": {
                  const toolResult = toolResults.find(
                    (toolResult) => toolResult.toolName === "installPackages",
                  );

                  if (!toolResult) {
                    throw new Error("installPackages: Tool result not found");
                  }

                  currentMessages.push({
                    role: "user",
                    content: `Finished installing the following packages: ${toolResult.result
                      .map((p) => {
                        if (p.success) {
                          return `${p.package?.name}@${p.package?.version}`;
                        }
                        return `Failed to install ${p.package?.name}: ${p.error}`;
                      })
                      .join(", ")}`,
                  });

                  break;
                }
                case "removePackages": {
                  const toolCall = toolCalls.find(
                    (toolCall) => toolCall.toolName === "removePackages",
                  );

                  if (!toolCall) {
                    throw new Error("removePackages: Tool call not found");
                  }

                  const deletedPkgs = installedPackages.filter((p) =>
                    toolCall.args.pkgs.includes(p.name),
                  );

                  for (const pkg of deletedPkgs) {
                    const packageResult = installedPackages.find(
                      (p) => p.name === pkg.name,
                    );

                    if (!packageResult) {
                      throw new Error(
                        `removePackages: Package not found: ${pkg.name}`,
                      );
                    }

                    deletedPackages.push(packageResult.id);
                  }

                  currentMessages.push({
                    role: "user",
                    content: `Finished removing the following packages: ${toolCall.args.pkgs.join(
                      ", ",
                    )}`,
                  });

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
        },
      });

      let currentFilePath = "";
      let currentAccumulatedText = "";
      let inCodeBlock = false;
      const previousLines: string[] = [];

      for await (const text of textStream) {
        response += text;
        currentAccumulatedText += text;

        // Process the accumulated text line by line
        while (currentAccumulatedText.includes("\n")) {
          const lineEndIndex = currentAccumulatedText.indexOf("\n");
          const line = currentAccumulatedText.substring(0, lineEndIndex);
          currentAccumulatedText = currentAccumulatedText.substring(
            lineEndIndex + 1,
          );

          // Store previous lines for filename detection
          previousLines.push(line);
          if (previousLines.length > 5) {
            // Keep only the last 5 lines for efficiency
            previousLines.shift();
          }

          // Detect filename at the start of a code block
          if (line.trim().startsWith("```") && !inCodeBlock) {
            const filename = findFilename({ lines: previousLines });
            if (filename) {
              console.log(`[coder:${projectId}] Working on ${filename}`);
              inCodeBlock = true;
              currentFilePath = filename;
              const fileIndex = streamValue.changedFiles.findIndex(
                (f) => f.path === filename,
              );

              if (fileIndex !== undefined && fileIndex !== -1) {
                streamValue.changedFiles[fileIndex] = {
                  path: filename,
                  status: "pending",
                };
              } else {
                streamValue.changedFiles.push({
                  path: filename,
                  status: "pending",
                });
              }

              await streamWriter.write(streamValue);
            }

            continue;
          }

          // Detect end of code block
          if (line.trim() === "```" && inCodeBlock) {
            console.log(
              `[coder:${projectId}] Finished working on ${currentFilePath}`,
            );
            inCodeBlock = false;

            // Update file status to success
            if (currentFilePath) {
              const fileIndex = streamValue.changedFiles.findIndex(
                (f) => f.path === currentFilePath,
              );

              if (fileIndex !== undefined && fileIndex !== -1) {
                streamValue.changedFiles[fileIndex] = {
                  path: currentFilePath,
                  status: "success",
                };
                await streamWriter.write(streamValue);
              }
            }

            currentFilePath = "";
          }
        }
      }

      const usageData = await usage;

      // Log usage
      console.log(
        `[coder:${projectId}] Usage Prompt: ${usageData.promptTokens} Completion: ${usageData.completionTokens} Total: ${usageData.totalTokens}`,
      );
    }

    await generate();

    // Process all edits at once
    const edits = getEdits({
      content: response,
    });

    // Apply the edits
    if (edits.length > 0) {
      const results = await applyEdits({
        existingFiles: filePaths,
        edits,
        projectId,
        fileCache,
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

    await insertMessages({
      tx,
      input: {
        chatId,
        userId,
        messages: [
          {
            id: versionMessageId,
            role: "version",
            rawContent: {
              versionId: version.id,
              versionMessage: version.message,
              versionNumber: version.number,
              versionDescription: version.description,
              changedFiles:
                finalResult.passed?.map((f) => ({
                  status: "success" as const,
                  path: f.path,
                })) || [],
            },
          },
        ],
      },
    });

    await tx
      .delete(versionDeclarations)
      .where(
        and(
          inArray(versionDeclarations.declarationId, deletedDeclarations),
          eq(versionDeclarations.versionId, version.id),
        ),
      );

    await tx
      .delete(versionFiles)
      .where(
        and(
          inArray(versionFiles.fileId, deletedFiles),
          eq(versionFiles.versionId, version.id),
        ),
      );

    await tx
      .delete(versionPackages)
      .where(
        and(
          inArray(versionPackages.packageId, deletedPackages),
          eq(versionPackages.versionId, version.id),
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
            userId,
          })
          .returning();

        if (!newFile) {
          throw new Error(
            `[processFile:${projectId}] Failed to insert file ${file.path}`,
          );
        }

        resultFile = newFile;
      }

      const s3VersionId = await S3.writeFile({
        projectId,
        path: resultFile.path,
        content: file.updated,
      });

      if (!s3VersionId) {
        throw new Error(
          `[processFile:${projectId}] Failed to write file ${file.path}`,
        );
      }

      // Add the file to the version
      await tx
        .insert(versionFiles)
        .values({
          versionId: version.id,
          fileId: resultFile.id,
          s3VersionId,
        })
        .onConflictDoUpdate({
          target: [versionFiles.versionId, versionFiles.fileId],
          set: {
            s3VersionId,
          },
        });
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
