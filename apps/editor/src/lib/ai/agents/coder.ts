import "server-only";

import {
  type InferInsertModel,
  type InferSelectModel,
  type Tx,
  and,
  eq,
  inArray,
} from "@weldr/db";
import {
  declarationPackages,
  declarations,
  dependencies,
  files,
  packages,
  versionDeclarations,
  versionFiles,
  versionPackages,
  versions,
} from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
import { S3 } from "@weldr/shared/s3";
import { declarationMetadataSchema } from "@weldr/shared/validators/declarations/index";
import {
  type CoreMessage,
  type CoreUserMessage,
  streamObject,
  streamText,
} from "ai";
import { z } from "zod";
import { models } from "../models";
import { processDeclarations } from "../process-declarations";
import { prompts } from "../prompts";
import {
  deleteFilesTool,
  installPackagesTool,
  readFilesTool,
  removePackagesTool,
} from "../tools";

class FileCache {
  private cache: Map<string, string> = new Map();

  async getFile({
    projectId,
    path,
  }: { projectId: string; path: string }): Promise<string | undefined> {
    const key = `${projectId}:${path}`;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const content = await S3.readFile({
      projectId,
      path,
    });

    if (content) {
      this.cache.set(key, content);
    }

    return content;
  }

  setFile({
    projectId,
    path,
    content,
  }: { projectId: string; path: string; content: string }): void {
    const key = `${projectId}:${path}`;
    this.cache.set(key, content);
  }
}

interface Edit {
  path: string;
  original: string;
  updated: string;
}

interface FailedEdit {
  edit: Edit;
  error: string;
}

type EditResult = {
  passed?: Edit;
  failed?: FailedEdit;
};

type EditResults = {
  passed?: Edit[];
  failed?: FailedEdit[];
};

const HEAD = /^<{5,9} SEARCH\s*$/;
const DIVIDER = /^={5,9}\s*$/;
const UPDATED = /^>{5,9} REPLACE\s*$/;

export async function coder({
  userId,
  projectId,
  versionId,
  previousVersionId,
  prompt,
  tx,
}: {
  userId: string;
  projectId: string;
  versionId: string;
  previousVersionId?: string;
  prompt: CoreUserMessage;
  tx: Tx;
}) {
  console.log("Starting coder agent", { userId, projectId });
  const currentMessages: CoreMessage[] = [prompt];
  const fileCache = new FileCache();

  const installedPackages = await tx.query.packages.findMany({
    where: eq(packages.projectId, projectId),
    columns: {
      name: true,
      description: true,
      type: true,
    },
  });
  const deletedPackages: string[] = [];
  const deletedDeclarations: string[] = [];
  const deletedFiles: string[] = [];

  let response = "";
  let finalResult: EditResults = {};

  const availableFiles = await tx.query.versionFiles.findMany({
    where: eq(versionFiles.versionId, previousVersionId ?? versionId),
    with: {
      file: {
        with: {
          declarations: true,
        },
      },
    },
  });

  const filePaths = availableFiles.map((versionFile) => versionFile.file.path);

  const context = getContext({
    installedPackages,
    availableFiles: availableFiles.map((v) => v.file),
  });

  async function generate() {
    const { textStream } = streamText({
      model: models.claudeSonnet,
      system: prompts.generalCoder(context),
      messages: currentMessages,
      tools: {
        installPackages: installPackagesTool({
          projectId,
          versionId,
          tx,
        }),
        removePackages: removePackagesTool,
        readFiles: readFilesTool({
          projectId,
        }),
        deleteFiles: deleteFilesTool({
          projectId,
          tx,
        }),
      },
      onFinish: async ({ finishReason, text, toolCalls, toolResults }) => {
        if (finishReason === "length") {
          currentMessages.push({
            role: "assistant",
            content: text,
          });

          await generate();
        }

        if (finishReason === "tool-calls") {
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

                currentMessages.push({
                  role: "user",
                  content: `Here are the files:\n${Object.entries(fileContents)
                    .map(
                      ([path, content]) => `${path}\n\`\`\`\n${content}\`\`\``,
                    )
                    .join("\n\n")}`,
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
                  content: `Finished installing the following packages: ${toolResult.args.pkgs.join(
                    ", ",
                  )}`,
                });

                break;
              }
              case "removePackages": {
                const toolResult = toolResults.find(
                  (toolResult) => toolResult.toolName === "removePackages",
                );

                if (!toolResult) {
                  throw new Error("removePackages: Tool result not found");
                }

                deletedPackages.push(...toolResult.args.pkgs);

                currentMessages.push({
                  role: "user",
                  content: `Finished removing the following packages: ${toolResult.args.pkgs.join(
                    ", ",
                  )}`,
                });

                break;
              }
              case "deleteFiles": {
                const toolResult = toolResults.find(
                  (toolResult) => toolResult.toolName === "deleteFiles",
                );

                if (!toolResult) {
                  throw new Error("deleteFiles: Tool result not found");
                }

                const deleted = await tx.query.declarations.findMany({
                  where: inArray(declarations.fileId, toolResult.args.files),
                });

                deletedDeclarations.push(...deleted.map((d) => d.id));
                deletedFiles.push(...toolResult.args.files);

                currentMessages.push({
                  role: "user",
                  content: `Finished deleting the following files: ${toolResult.args.files.join(
                    ", ",
                  )}`,
                });

                break;
              }
              default: {
                console.log("Unknown tool call");
                break;
              }
            }
          }

          await generate();
        }
      },
    });

    // Collect the entire response
    for await (const text of textStream) {
      response += text;
      console.log(text);
    }

    // Process all edits at once
    const edits = getEdits({
      content: response,
      filePaths,
    });

    // Apply the edits
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
    });

    // Add results to running totals
    if (results.passed) {
      finalResult.passed = results.passed;
    }

    if (results.failed) {
      finalResult.failed = results.failed;
    }
  }

  await generate();

  console.log("Current edits", {
    passed: finalResult.passed,
    failed: finalResult.failed,
  });

  let retryCount = 0;

  while (finalResult.failed && finalResult.failed.length > 0) {
    retryCount++;

    console.log(`Retry attempt ${retryCount} for failed edits`, {
      failedCount: finalResult.failed?.length,
    });

    // Add failed edits info to messages
    const failureDetails = finalResult.failed
      ?.map((f) => `Failed to edit ${f.edit.path}:\n${f.error}`)
      .join("\n\n");

    currentMessages.push({
      role: "assistant",
      content: response,
    });

    currentMessages.push({
      role: "user",
      content: `Some edits failed. Please fix the following issues and try again:\n\n${failureDetails}`,
    });

    // Reset for next attempt
    finalResult = {
      passed: [],
      failed: [],
    };
    response = "";

    // Generate new response
    await generate();
  }

  console.log("Coder agent completed", {
    passed: finalResult.passed,
    failed: finalResult.failed,
  });

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
  let currentPackageDotJson:
    | {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      }
    | undefined = undefined;

  if (currentMachineId) {
    currentMachine = await Fly.machine.get({
      projectId,
      machineId: currentMachineId,
    });

    // Get current package.json
    const currentPackageJson = await Fly.machine.executeCommand({
      projectId,
      machineId: currentMachineId,
      command: ["cat", "/app/package.json"],
    });

    if (!currentPackageJson.stdout) {
      throw new Error("Failed to get current package.json");
    }

    currentPackageDotJson = JSON.parse(currentPackageJson.stdout);
  }

  const filteredPackageDotJson =
    deletedPackages.length > 0
      ? {
          dependencies: Object.keys(
            currentPackageDotJson?.dependencies || {},
          ).filter((pkg) => !deletedPackages.includes(pkg)),
          devDependencies: Object.keys(
            currentPackageDotJson?.devDependencies || {},
          ).filter((pkg) => !deletedPackages.includes(pkg)),
        }
      : undefined;

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
    ...(filteredPackageDotJson
      ? [
          {
            guest_path: "/app/package.json",
            raw_value: Buffer.from(
              JSON.stringify(filteredPackageDotJson),
            ).toString("base64"),
          },
        ]
      : []),
  ];

  console.log("updatedFiles", updatedFiles);

  // Create a new machine
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
  await Fly.machine.executeCommand({
    projectId,
    machineId,
    command: ["bun", "install"],
  });

  const runtimePkgs = installedPackages.filter(
    (pkg) =>
      pkg.type === "runtime" && !currentPackageDotJson?.dependencies[pkg.name],
  );

  const devPkgs = installedPackages.filter(
    (pkg) =>
      pkg.type === "development" &&
      !currentPackageDotJson?.devDependencies[pkg.name],
  );

  // Install new runtime packages
  if (runtimePkgs.length > 0) {
    console.log("Installing runtime packages", runtimePkgs);
    await Fly.machine.executeCommand({
      projectId,
      machineId,
      command: ["bun", "add", ...runtimePkgs.map((pkg) => pkg.name)],
    });
  }

  // Install new dev packages
  if (devPkgs.length > 0) {
    console.log("Installing dev packages", devPkgs);
    await Fly.machine.executeCommand({
      projectId,
      machineId,
      command: ["bun", "add", "--dev", ...devPkgs.map((pkg) => pkg.name)],
    });
  }
}

function getContext({
  installedPackages,
  availableFiles,
}: {
  installedPackages: Omit<
    InferSelectModel<typeof packages>,
    "id" | "projectId"
  >[];
  availableFiles: (InferSelectModel<typeof files> & {
    declarations: InferSelectModel<typeof declarations>[];
  })[];
}): string {
  return `
  Currently installed packages:
  ${installedPackages.map((pkg) => `${pkg.name}`).join("\n")}

  Available Files:
  ${availableFiles
    .map(
      (file) =>
        `${file.path}
  ${file.declarations
    .map((declaration) => {
      const metadata = declaration.metadata;
      if (!metadata) return "";

      switch (metadata.type) {
        case "endpoint": {
          const def = metadata.definition;
          if (def.subtype === "rest") {
            return `  • API Endpoint: ${def.method.toUpperCase()} ${def.path}
      Summary: ${def.summary || "No summary"}
      ${def.description ? `Description: ${def.description}` : ""}`;
          }
          return `  • RPC Endpoint: ${def.name}
      Description: ${def.description}
      Parameters: ${def.parameters ? JSON.stringify(def.parameters) : "None"}
      Returns: ${def.returns ? JSON.stringify(def.returns) : "void"}`;
        }

        case "component": {
          const def = metadata.definition;
          let info = `  • ${def.subtype === "page" ? "Page" : def.subtype === "layout" ? "Layout" : "Component"}: ${def.name}
      Description: ${def.description}
      Renders on: ${def.rendersOn || "both"}`;

          if (def.subtype === "page" || def.subtype === "layout") {
            info += def.route ? `\n    Route: ${def.route}` : "";
          }
          if (def.properties) {
            info += `\n    Props: ${JSON.stringify(def.properties)}`;
          }
          return info;
        }

        case "function": {
          return `  • Function: ${metadata.name}
      Description: ${metadata.description}
      ${metadata.parameters ? `Parameters: ${JSON.stringify(metadata.parameters)}` : ""}
      ${metadata.returns ? `Returns: ${JSON.stringify(metadata.returns)}` : ""}`;
        }

        case "model": {
          return `  • Model: ${metadata.name}
      Columns: ${metadata.columns.map((col) => `${col.name} (${col.type})`).join(", ")}
      ${metadata.relationships ? `Relations: ${metadata.relationships.length} defined` : ""}`;
        }

        case "other": {
          return `  • ${metadata.declType}: ${metadata.name}
      Description: ${metadata.description}`;
        }

        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n")}`,
    )
    .join("\n\n")}
  `;
}

function calculateSimilarityRatio({
  a,
  b,
}: {
  a: string[];
  b: string[];
}): number {
  const matches = a.filter((val, idx) => val === b[idx]).length;
  const total = Math.max(a.length, b.length);
  return total === 0 ? 1 : matches / total;
}

function findFilename({
  lines,
  filePaths,
}: {
  lines: string[];
  filePaths?: string[];
}): string | null {
  // Look for filename before the code block starts
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    // If we hit a code block marker, use the previous non-empty line as filename
    if (line?.startsWith("```")) {
      // Look backwards for the first non-empty line
      for (let j = i - 1; j >= 0; j--) {
        const potentialFilename = lines[j]?.trim();
        if (potentialFilename) {
          // If filePaths is provided, try to match against them
          if (filePaths) {
            if (filePaths.includes(potentialFilename)) {
              return potentialFilename;
            }
            // Check if basename matches
            const basename = potentialFilename.split("/").pop();
            if (basename) {
              const matchingFile = filePaths.find(
                (f) => f.split("/").pop() === basename,
              );
              if (matchingFile) {
                return matchingFile;
              }
            }
          }
          return potentialFilename;
        }
      }
      break;
    }
  }
  return null;
}

function collectUntilPattern(
  lines: string[],
  pattern: RegExp,
): { lines: string[]; newIndex: number } {
  const index = lines.findIndex((line) => pattern.test(line.trim()));
  return {
    lines: lines.slice(0, index),
    newIndex: index,
  };
}

function getEdits({
  content,
  filePaths,
}: {
  content: string;
  filePaths: string[];
}): Edit[] {
  const lines = content.split("\n");

  return lines.reduce<{
    results: Edit[];
    currentIndex: number;
    currentFilename: string | null;
  }>(
    ({ results, currentFilename }, line, i) => {
      if (!HEAD.test(line.trim())) {
        return { results, currentIndex: i + 1, currentFilename };
      }

      try {
        // Find filename from previous lines
        const prevLines = lines.slice(Math.max(0, i - 3), i);
        const filename =
          findFilename({
            lines: prevLines,
            filePaths,
          }) || currentFilename;

        if (!filename) {
          throw new Error("Missing filename before edit block");
        }

        // Get original text
        const remainingLines = lines.slice(i + 1);
        const { lines: originalLines, newIndex: afterOriginal } =
          collectUntilPattern(remainingLines, DIVIDER);

        if (afterOriginal >= remainingLines.length) {
          throw new Error("Expected =======");
        }

        // Get updated text
        const { lines: updatedLines, newIndex: afterUpdated } =
          collectUntilPattern(remainingLines.slice(afterOriginal + 1), UPDATED);

        if (afterUpdated >= remainingLines.length) {
          throw new Error("Expected >>>>>>> REPLACE");
        }

        const newEdit: Edit = {
          path: filename,
          original: originalLines.join("\n"),
          updated: updatedLines.join("\n"),
        };

        return {
          results: [...results, newEdit],
          currentIndex: i + afterOriginal + afterUpdated + 2,
          currentFilename: filename,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Error parsing edit block: ${error.message}`);
        }
        throw error;
      }
    },
    { results: [], currentIndex: 0, currentFilename: null },
  ).results;
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((val, index) => val === b[index]);
}

function perfectReplace({
  wholeLines,
  partLines,
  replaceLines,
}: {
  wholeLines: string[];
  partLines: string[];
  replaceLines: string[];
}): string[] | null {
  const partLen = partLines.length;

  for (let i = 0; i <= wholeLines.length - partLen; i++) {
    const chunk = wholeLines.slice(i, i + partLen);
    if (arraysEqual(chunk, partLines)) {
      return [
        ...wholeLines.slice(0, i),
        ...replaceLines,
        ...wholeLines.slice(i + partLen),
      ];
    }
  }

  return null;
}

function replaceWithFlexibleWhitespace({
  wholeLines,
  partLines,
  replaceLines,
}: {
  wholeLines: string[];
  partLines: string[];
  replaceLines: string[];
}): string[] | null {
  // Try matching ignoring leading whitespace
  const strippedPartLines = partLines.map((line) => line.trimLeft());
  const partLen = partLines.length;

  for (let i = 0; i <= wholeLines.length - partLen; i++) {
    const chunk = wholeLines.slice(i, i + partLen);
    const strippedChunk = chunk.map((line) => line.trimLeft());

    if (arraysEqual(strippedChunk, strippedPartLines)) {
      // Preserve the original leading whitespace
      const leadingSpaceMatch = chunk[0]?.match(/^\s*/);
      const leadingSpace = leadingSpaceMatch ? leadingSpaceMatch[0] : "";
      const adjustedReplace = replaceLines.map(
        (line) => leadingSpace + line.trimLeft(),
      );
      return [
        ...wholeLines.slice(0, i),
        ...adjustedReplace,
        ...wholeLines.slice(i + partLen),
      ];
    }
  }

  return null;
}

function findSimilarLines({
  searchText,
  content,
  threshold = 0.6,
}: {
  searchText: string;
  content: string;
  threshold?: number;
}): string | null {
  const searchLines = searchText.split("\n");
  const contentLines = content.split("\n");

  let bestRatio = 0;
  let bestMatch: string[] | null = null;

  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    const chunk = contentLines.slice(i, i + searchLines.length);
    const ratio = calculateSimilarityRatio({
      a: searchLines,
      b: chunk,
    });

    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestMatch = chunk;
    }
  }

  if (bestRatio < threshold || !bestMatch) {
    return null;
  }

  return bestMatch.join("\n");
}

function doReplace({
  content,
  originalText,
  updatedText,
}: {
  content: string;
  originalText: string;
  updatedText: string;
}): string | null {
  // Handle new file creation
  if (!originalText.trim() && !content) {
    return updatedText;
  }

  // Try exact match first
  const exactMatch = perfectReplace({
    wholeLines: content.split("\n"),
    partLines: originalText.split("\n"),
    replaceLines: updatedText.split("\n"),
  });
  if (exactMatch) {
    return exactMatch.join("\n");
  }

  // Try matching with flexible whitespace
  const flexMatch = replaceWithFlexibleWhitespace({
    wholeLines: content.split("\n"),
    partLines: originalText.split("\n"),
    replaceLines: updatedText.split("\n"),
  });
  if (flexMatch) {
    return flexMatch.join("\n");
  }

  return null;
}

export async function applyEdit({
  existingFiles,
  edit,
  projectId,
  fileCache,
}: {
  existingFiles: string[];
  edit: Edit;
  projectId: string;
  fileCache: FileCache;
}): Promise<EditResult> {
  console.log("Applying edit", { edit });

  let passed: Edit | undefined = undefined;
  let failed: FailedEdit | undefined = undefined;

  try {
    // Handle new file creation
    if (!edit.original.trim()) {
      // If the file already exists, return the edit as failed
      if (existingFiles.includes(edit.path)) {
        console.log("Cannot create existing file", { path: edit.path });
        failed = {
          edit,
          error: `Cannot create ${edit.path} - file already exists`,
        };
        return { passed, failed };
      }

      console.log("Creating new file", { path: edit.path });
      passed = edit;
      return { passed, failed };
    }

    // Handle existing file edits
    const content = await fileCache.getFile({
      projectId,
      path: edit.path,
    });

    if (!content) {
      throw new Error(`File not found: ${edit.path}`);
    }

    const newContent = doReplace({
      content,
      originalText: edit.original,
      updatedText: edit.updated,
    });

    if (newContent) {
      passed = {
        ...edit,
        updated: newContent,
      };
      return { passed, failed };
    }

    let errorMsg = `Failed to apply edit to ${edit.path}\n`;
    errorMsg +=
      "The SEARCH section must exactly match an existing block of lines including all white space, comments, indentation, docstrings, etc\n";

    const similarLines = findSimilarLines({
      searchText: edit.original,
      content,
    });
    if (similarLines) {
      errorMsg += `\nDid you mean to match these lines?\n${similarLines}\n`;
    }

    if (content.includes(edit.updated.trim()) && edit.updated.trim()) {
      errorMsg += `\nAre you sure you need this SEARCH/REPLACE block?\nThe REPLACE lines are already in ${edit.path}!\n`;
    }

    failed = { edit, error: errorMsg };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to apply edit", {
      path: edit.path,
      error: errorMessage,
    });

    failed = {
      edit,
      error: `Error processing ${edit.path}: ${errorMessage}`,
    };
  }

  return { passed, failed };
}

export async function applyEdits({
  existingFiles,
  edits,
  projectId,
  versionId,
  previousVersionId,
  userId,
  tx,
  deletedDeclarations,
  fileCache,
}: {
  existingFiles: string[];
  edits: Edit[];
  projectId: string;
  versionId: string;
  previousVersionId?: string;
  userId: string;
  tx: Tx;
  deletedDeclarations: string[];
  fileCache: FileCache;
}): Promise<{
  passed: Edit[];
  failed: FailedEdit[];
}> {
  const passed: Edit[] = [];
  const failed: FailedEdit[] = [];

  for (const edit of edits) {
    const result = await applyEdit({
      existingFiles,
      edit,
      projectId,
      fileCache,
    });

    if (result.passed) {
      // Process file only if edit passed
      await processFile({
        content: result.passed.updated,
        path: result.passed.path,
        projectId,
        versionId,
        userId,
        tx,
        previousVersionId,
        deletedDeclarations,
        fileCache,
      });
      passed.push(result.passed);
    }
    if (result.failed) {
      failed.push(result.failed);
    }
  }

  return { passed, failed };
}

async function processFile({
  content,
  path,
  projectId,
  versionId,
  userId,
  tx,
  previousVersionId,
  deletedDeclarations,
  fileCache,
}: {
  content: string;
  path: string;
  projectId: string;
  versionId: string;
  userId: string;
  tx: Tx;
  previousVersionId?: string;
  deletedDeclarations: string[];
  fileCache: FileCache;
}) {
  let file = await tx.query.files.findFirst({
    where: and(eq(files.projectId, projectId), eq(files.path, path)),
  });

  let previousContent: string | undefined = undefined;

  if (!file) {
    const [insertedFile] = await tx
      .insert(files)
      .values({
        projectId,
        path,
        userId,
      })
      .returning();

    file = insertedFile;
  } else {
    previousContent = await fileCache.getFile({
      projectId,
      path,
    });
  }

  if (!file) {
    throw new Error(`Failed to insert/select file ${path}`);
  }

  // Save the file to S3
  const s3Version = await S3.writeFile({
    projectId,
    path: file.path,
    content,
  });

  if (!s3Version) {
    throw new Error(`Failed to write file ${file.path} to S3`);
  }

  // Cache the new content
  fileCache.setFile({
    projectId,
    path: file.path,
    content,
  });

  // Add the file to the version
  await tx.insert(versionFiles).values({
    versionId,
    fileId: file.id,
    s3VersionId: s3Version,
  });

  const processedDeclarations = await processDeclarations({
    fileContent: content,
    filePath: path,
    previousContent,
  });

  let previousVersionDeclarations: InferSelectModel<typeof declarations>[] = [];
  let declarationsToDelete: InferSelectModel<typeof declarations>[] = [];

  if (previousVersionId) {
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

    declarationsToDelete = previousVersionDeclarations.filter((d) =>
      Object.keys(processedDeclarations.deletedDeclarations).includes(d.name),
    );
  }

  // Annotate the new declarations
  console.log("Annotating new declarations");
  // const annotations = await annotator({
  //   code: content,
  //   newDeclarations: Object.keys(processedDeclarations.newDeclarations),
  //   updatedDeclarations: previousVersionDeclarations,
  // });

  const { object, partialObjectStream } = streamObject({
    model: models.claudeSonnet,
    schema: z.object({
      annotations: declarationMetadataSchema
        .describe(
          "The list of metadata of the exported declarations. Create the metadata for the provided declarations only. It will be used to generate the documentation. MUST be a valid JSON object not a string.",
        )
        .array(),
    }),
    system:
      "Please, create metadata for the provided declarations based on the code. You must create metadata for new declarations and update the metadata for updated declarations if needed. You must return a valid JSON object not a string.",
    prompt: `# Code

${file.path}
\`\`\`
${content}
\`\`\`

${
  Object.keys(processedDeclarations.newDeclarations).length > 0
    ? `# New declarations\n${Object.keys(
        processedDeclarations.newDeclarations,
      ).join("\n")}`
    : ""
}${
  previousVersionDeclarations.length > 0
    ? `\n\n# Updated declarations\n${previousVersionDeclarations.map(
        (declaration) =>
          `- ${declaration.name}\n${JSON.stringify(declaration.metadata)}`,
      )}`
    : ""
}`,
  });

  for await (const partialObject of partialObjectStream) {
    console.clear();
    console.log(partialObject);
  }

  const annotations = (await object).annotations;

  // Insert declarations
  const insertedDeclarations = await tx
    .insert(declarations)
    .values(
      annotations.map((annotation) => {
        const name = (() => {
          switch (annotation.type) {
            case "component": {
              return annotation.definition.name;
            }
            case "function":
            case "model":
            case "other": {
              return annotation.name;
            }
            case "endpoint": {
              switch (annotation.definition.subtype) {
                case "rest": {
                  return `${annotation.definition.method.toUpperCase()}:${annotation.definition.path}`;
                }
                case "rpc": {
                  return `${annotation.definition.name}`;
                }
              }
            }
          }
        })();

        return {
          fileId: file.id,
          name,
          type: annotation.type,
          metadata: annotation,
          projectId,
          userId,
          previousId: previousVersionDeclarations.find((d) => d.name === name)
            ?.id,
        } as InferInsertModel<typeof declarations>;
      }),
    )
    .onConflictDoNothing()
    .returning();

  // Insert version declarations
  if (insertedDeclarations.length > 0) {
    await tx.insert(versionDeclarations).values(
      insertedDeclarations.map((d) => ({
        versionId,
        declarationId: d.id,
      })),
    );
  }

  const tempDeclarations = {
    ...processedDeclarations.newDeclarations,
    ...processedDeclarations.updatedDeclarations,
  };

  // Insert declaration dependencies
  for (const declaration of insertedDeclarations) {
    const declarationDependencies = tempDeclarations[declaration.name] ?? [];

    // Insert the declaration packages
    const pkgs = declarationDependencies.filter((d) => d.type === "external");

    const savedPkgs = await tx.query.packages.findMany({
      where: and(
        inArray(
          packages.name,
          pkgs.map((p) => p.name),
        ),
        eq(packages.projectId, projectId),
      ),
    });

    if (pkgs.length > 0) {
      await tx.insert(declarationPackages).values(
        pkgs.map((pkg) => {
          const pkgId = savedPkgs.find((p) => p.name === pkg.name)?.id;

          if (!pkgId) {
            throw new Error(`Package not found: ${pkg.name}`);
          }

          return {
            declarationId: declaration.id,
            packageId: pkgId,
            importPath: pkg.name,
            declarations: pkg.dependsOn,
          };
        }),
      );
    }

    // Insert declaration dependencies
    const internalDependencies = declarationDependencies.filter(
      (d) => d.type === "internal",
    );

    for (const dependency of internalDependencies) {
      const tempDependencies = previousVersionDeclarations.filter((d) =>
        dependency.dependsOn.includes(d.name),
      );

      if (tempDependencies.length > 0) {
        await tx.insert(dependencies).values(
          tempDependencies.map((d) => ({
            dependentType: declaration.type,
            dependentId: declaration.id,
            dependencyType: d.type,
            dependencyId: d.id,
          })),
        );
      }
    }
  }

  deletedDeclarations.push(...declarationsToDelete.map((d) => d.id));
}
