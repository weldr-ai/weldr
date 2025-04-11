import "server-only";

import type { TStreamableValue } from "@/types";
import { type InferSelectModel, type Tx, eq, inArray } from "@weldr/db";
import {
  declarations,
  type files,
  packages,
  versionDeclarations,
  versionFiles,
  versionPackages,
  versions,
} from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
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
  readPackageJsonTool,
  removePackagesTool,
} from "../../tools";
import { getFilesContext, getFolderStructure } from "./context";
import {
  DIVIDER,
  REPLACE,
  SEARCH,
  applyEdits,
  findFilename,
  getEdits,
} from "./editor";
import { FileCache } from "./file-cache";
import type { EditResults } from "./types";
import { BASE_PACKAGE_DOT_JSON, getPackageVersion } from "./utils";

export async function coder({
  streamWriter,
  userId,
  chatId,
  projectId,
  versionId,
  previousVersionId,
  promptMessages,
  tx,
}: {
  streamWriter: WritableStreamDefaultWriter<TStreamableValue>;
  userId: string;
  chatId: string;
  projectId: string;
  versionId: string;
  previousVersionId?: string;
  promptMessages: CoreMessage[];
  tx: Tx;
}) {
  console.log(`[coder:${projectId}] Starting coder agent`);

  const currentMessages: CoreMessage[] = [...promptMessages];
  const fileCache = new FileCache();
  const processedFiles = new Set<string>();

  const installedPackages = await tx.query.packages.findMany({
    where: eq(packages.projectId, projectId),
    columns: {
      name: true,
      description: true,
      type: true,
    },
  });
  const newPackages: { name: string; type: "runtime" | "development" }[] = [];
  const deletedPackages: string[] = [];
  const deletedDeclarations: string[] = [];
  const deletedFiles: string[] = [];

  let response = "";
  const finalResult: EditResults = {};

  const availableFiles = await tx.query.versionFiles.findMany({
    where: eq(versionFiles.versionId, previousVersionId ?? versionId),
    columns: {
      fileId: false,
      versionId: false,
      s3VersionId: false,
    },
    with: {
      file: {
        columns: {
          path: true,
        },
        with: {
          declarations: {
            columns: {
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

  const filePaths = availableFiles.map((versionFile) => versionFile.file.path);

  const flatFiles = availableFiles.map((v) => ({
    path: v.file.path,
    declarations: v.file.declarations.map((d) => ({
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

  async function generate() {
    const { textStream, usage } = streamText({
      model: registry.languageModel("anthropic:claude-3-5-sonnet-latest"),
      system: prompts.generalCoder(context),
      messages: currentMessages,
      tools: {
        installPackages: installPackagesTool({
          projectId,
          versionId,
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
        readPackageJson: readPackageJsonTool({
          projectId,
          pkgs: installedPackages,
        }),
      },
      onFinish: async ({ finishReason, text, toolCalls, toolResults }) => {
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

                const deleted = await tx.query.declarations.findMany({
                  where: inArray(declarations.fileId, toolCall.args.files),
                });

                deletedDeclarations.push(...deleted.map((d) => d.id));
                deletedFiles.push(...toolCall.args.files);

                currentMessages.push({
                  role: "user",
                  content: `Finished deleting the following files: ${toolCall.args.files.join(
                    ", ",
                  )}`,
                });

                break;
              }
              case "installPackages": {
                const toolCall = toolCalls.find(
                  (toolCall) => toolCall.toolName === "installPackages",
                );

                if (!toolCall) {
                  throw new Error("installPackages: Tool call not found");
                }

                newPackages.push(...toolCall.args.pkgs);

                currentMessages.push({
                  role: "user",
                  content: `Finished installing the following packages: ${toolCall.args.pkgs.join(
                    ", ",
                  )}`,
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

                deletedPackages.push(...toolCall.args.pkgs);

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
        } else {
          console.log(`[coder:${projectId}] Finished with ${finishReason}`);
        }
      },
    });

    let streamValue:
      | {
          type: "code";
          files: Record<
            string,
            {
              originalContent: string | undefined;
              newContent: string | undefined;
            }
          >;
        }
      | undefined = undefined;

    let streamFilePath = "";
    let streamOriginalContent = "";
    let streamNewContent = "";
    let currentAccumulatedText = "";
    let inSearchBlock = false;
    let inReplaceBlock = false;
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
            console.log(`[coder:${projectId}] Writing to file ${filename}`);
            streamFilePath = filename;
            streamOriginalContent = "";
            streamNewContent = "";
            inSearchBlock = false;
            inReplaceBlock = false;
            inCodeBlock = true;
          }

          continue;
        }

        // Detect end of code block
        if (line.trim() === "```" && inCodeBlock) {
          inCodeBlock = false;
          inSearchBlock = false;
          inReplaceBlock = false;
          streamFilePath = "";
          continue;
        }

        // Only process SEARCH/REPLACE patterns if we're inside a code block
        if (inCodeBlock) {
          // Detect SEARCH marker
          if (SEARCH.test(line.trim())) {
            inSearchBlock = true;
            inReplaceBlock = false;
            continue;
          }

          // Detect divider between SEARCH and REPLACE
          if (DIVIDER.test(line.trim()) && inSearchBlock) {
            inSearchBlock = false;
            inReplaceBlock = true;
            continue;
          }

          // Detect REPLACE marker (end of the block)
          if (REPLACE.test(line.trim())) {
            inCodeBlock = false;
            inSearchBlock = false;
            inReplaceBlock = false;
            streamFilePath = "";
            continue;
          }

          // Add content to the appropriate section
          if (inSearchBlock) {
            streamOriginalContent += `${line}\n`;
            // Update stream immediately when SEARCH content changes
            await updateStream();
          } else if (inReplaceBlock) {
            streamNewContent += `${line}\n`;
            // Update stream immediately when REPLACE content changes
            await updateStream();
          }
        }

        // Helper function to update stream in real-time
        async function updateStream() {
          if (streamFilePath && streamFilePath.length > 0) {
            if (!streamValue) {
              streamValue = {
                type: "code",
                files: {},
              };
            }

            // Make sure we're sending the full content, not just the first line
            streamValue.files = {
              ...streamValue.files,
              [streamFilePath]: {
                originalContent:
                  streamOriginalContent.length > 0
                    ? streamOriginalContent
                    : undefined,
                newContent:
                  streamNewContent.length > 0 ? streamNewContent : undefined,
              },
            };

            // Send immediate update to the UI
            await streamWriter.write({
              ...streamValue,
            });
          }
        }
      }
    }

    if (streamValue) {
      const value = streamValue as {
        type: "code";
        files: Record<
          string,
          {
            originalContent: string | undefined;
            newContent: string | undefined;
          }
        >;
      };

      const [messageId] = await insertMessages({
        tx,
        input: {
          chatId,
          userId,
          messages: [
            {
              role: "code",
              rawContent: value.files,
              createdAt: new Date(),
            },
          ],
        },
      });

      if (!messageId) {
        throw new Error("Message ID not found");
      }

      await streamWriter.write({
        id: messageId,
        ...value,
      });
    }

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
        versionId,
        previousVersionId,
        userId,
        tx,
        deletedDeclarations,
        fileCache,
        processedFiles,
        streamWriter,
      });

      // Add results to running totals by accumulating them
      if (results.passed) {
        finalResult.passed = [...(finalResult.passed || []), ...results.passed];
      }

      if (results.failed) {
        finalResult.failed = [...(finalResult.failed || []), ...results.failed];
      }
    }

    const usageData = await usage;

    // Log usage
    console.log(
      `[coder:${projectId}] Usage Prompt: ${usageData.promptTokens} Completion: ${usageData.completionTokens} Total: ${usageData.totalTokens}`,
    );
  }

  await generate();

  let retryCount = 0;
  let currentFailedEdits = finalResult.failed || [];

  while (currentFailedEdits.length > 0 && retryCount < 3) {
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

  // Complete version snapshot
  let previousVersionDeclarations: InferSelectModel<typeof declarations>[] = [];
  let previousVersionPackages: InferSelectModel<typeof packages>[] = [];
  let previousVersionFiles: (InferSelectModel<typeof files> & {
    s3VersionId: string;
  })[] = [];
  let currentMachineId: string | null = null;

  if (previousVersionId) {
    const version = await tx.query.versions.findFirst({
      where: eq(versions.id, previousVersionId),
    });

    if (!version) {
      throw new Error("Version not found");
    }

    currentMachineId = version.machineId;

    const versionDeclarationsResult =
      await tx.query.versionDeclarations.findMany({
        where: eq(versionDeclarations.versionId, previousVersionId),
        with: {
          declaration: true,
        },
      });

    previousVersionDeclarations = versionDeclarationsResult.map(
      (v) => v.declaration,
    );

    const versionDeclarationPackagesResult =
      await tx.query.versionPackages.findMany({
        where: eq(versionPackages.versionId, previousVersionId),
        with: {
          package: true,
        },
      });

    previousVersionPackages = versionDeclarationPackagesResult.map(
      (v) => v.package,
    );

    const versionFilesResult = await tx.query.versionFiles.findMany({
      where: eq(versionFiles.versionId, previousVersionId),
      with: {
        file: true,
      },
    });

    previousVersionFiles = versionFilesResult.map((v) => {
      return {
        ...v.file,
        s3VersionId: v.s3VersionId,
      };
    });
  }

  // Insert version declarations
  const filteredPreviousVersionDeclarations =
    previousVersionDeclarations.filter(
      (d) => !deletedDeclarations.includes(d.name),
    );

  if (filteredPreviousVersionDeclarations.length > 0) {
    await tx.insert(versionDeclarations).values([
      ...filteredPreviousVersionDeclarations.map((d) => ({
        versionId,
        declarationId: d.id,
      })),
    ]);
  }

  // Insert version packages
  const filteredPreviousVersionPackages = previousVersionPackages.filter(
    (p) => !deletedPackages.includes(p.name),
  );

  if (filteredPreviousVersionPackages.length > 0) {
    await tx.insert(versionPackages).values([
      ...filteredPreviousVersionPackages.map((p) => ({
        versionId,
        packageId: p.id,
      })),
    ]);
  }

  // Insert version files
  const filteredPreviousVersionFiles = previousVersionFiles.filter(
    (f) => !deletedFiles.includes(f.path),
  );

  if (filteredPreviousVersionFiles.length > 0) {
    await tx.insert(versionFiles).values([
      ...filteredPreviousVersionFiles.map((f) => ({
        versionId,
        fileId: f.id,
        s3VersionId: f.s3VersionId,
      })),
    ]);
  }

  let currentMachine: Awaited<ReturnType<typeof Fly.machine.get>> | null = null;
  let currentPackageDotJson: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } = BASE_PACKAGE_DOT_JSON;

  if (currentMachineId) {
    currentMachine = await Fly.machine.get({
      projectId,
      machineId: currentMachineId,
    });

    // Get current package.json
    const currentPackageJson = await Fly.machine.executeCommand({
      projectId,
      machineId: currentMachineId,
      command: "cat /app/package.json",
    });

    if (!currentPackageJson.stdout) {
      throw new Error("Failed to get current package.json");
    }

    currentPackageDotJson = JSON.parse(currentPackageJson.stdout);
  }

  // Add new packages to package.json
  for (const pkg of newPackages) {
    const version = await getPackageVersion(pkg.name);

    if (version) {
      if (
        pkg.type === "runtime" &&
        !currentPackageDotJson?.dependencies[pkg.name]
      ) {
        currentPackageDotJson.dependencies[pkg.name] = version;
      } else if (
        pkg.type === "development" &&
        !currentPackageDotJson?.devDependencies[pkg.name]
      ) {
        currentPackageDotJson.devDependencies[pkg.name] = version;
      }
    }
  }

  // Filter deleted packages from package.json
  for (const pkg of deletedPackages) {
    if (currentPackageDotJson?.dependencies?.[pkg]) {
      delete currentPackageDotJson.dependencies?.[pkg];
    }
    if (currentPackageDotJson?.devDependencies?.[pkg]) {
      delete currentPackageDotJson.devDependencies?.[pkg];
    }
  }

  const updatedFiles = [
    ...(currentMachine?.config?.files?.filter(
      (file) =>
        !finalResult.passed?.some(
          (passedFile) => `/app/${passedFile.path}` === file.guest_path,
        ),
    ) || []),
    ...(finalResult.passed?.map((file) => ({
      guest_path: `/app/${file.path}`,
      raw_value: Buffer.from(file.updated).toString("base64"),
    })) || []),
    ...(currentPackageDotJson
      ? [
          {
            guest_path: "/app/package.json",
            raw_value: Buffer.from(
              JSON.stringify(currentPackageDotJson),
            ).toString("base64"),
          },
        ]
      : []),
  ];

  console.log(
    `[coder:${projectId}] Updated files`,
    updatedFiles.map((f) => f.guest_path),
  );

  // Create a new machine
  console.log(
    `[coder:${projectId}] Creating new machine with ${updatedFiles.length} files`,
  );

  const machineId = await Fly.machine.create({
    projectId,
    versionId,
    config: {
      image: "registry.fly.io/boilerplates:next",
      files: updatedFiles,
    },
  });

  // Update version with new machine ID
  await tx
    .update(versions)
    .set({
      machineId,
    })
    .where(eq(versions.id, versionId));

  // Install packages
  console.log(
    `[coder:${projectId}] Installing packages ${installedPackages.map(
      (pkg) => pkg.name,
    )}`,
  );
  await Fly.machine.executeCommand({
    projectId,
    machineId,
    command: "cd app && bun i",
  });

  return machineId;
}
