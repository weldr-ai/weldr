import "server-only";

import { type InferSelectModel, type Tx, and, eq } from "@weldr/db";
import { declarations, files, packages } from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
import { S3 } from "@weldr/shared/s3";
import { type CoreMessage, type CoreUserMessage, streamText } from "ai";
import { models } from "../models";
import { prompts } from "../prompts";
import { installPackagesTool, readFilesTool } from "../tools";
import { annotator } from "./annotator";

export async function coder({
  userId,
  projectId,
  versionId,
  machineId,
  prompt,
  tx,
}: {
  userId: string;
  projectId: string;
  versionId: string;
  machineId: string;
  prompt: CoreUserMessage;
  tx: Tx;
}) {
  console.log("Starting coder agent", { userId, projectId });

  const currentMessages: CoreMessage[] = [prompt];

  const availableFiles = await tx.query.files.findMany({
    where: eq(files.projectId, projectId),
    with: {
      declarations: true,
    },
  });

  const installedPackages = await tx.query.packages.findMany({
    where: and(eq(packages.projectId, projectId), eq(packages.type, "runtime")),
  });

  const context = getContext({
    installedPackages,
    availableFiles,
  });

  const filesCache: Record<string, string> = {};

  let response = "";
  let processedResponse = "";

  const filePaths = availableFiles.map((file) => file.path);
  const passedEdits: Edit[] = [];
  const failedEdits: FailedEdit[] = [];

  async function generate() {
    const { textStream } = streamText({
      model: models.claudeSonnet,
      system: prompts.generalCoder(context),
      messages: currentMessages,
      tools: {
        installPackages: installPackagesTool({
          projectId,
          machineId,
          versionId,
          tx,
        }),
        readFiles: readFilesTool({
          projectId,
          filesCache,
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
              case "installPackages": {
                const toolResult = toolResults.find(
                  (toolResult) => toolResult.toolName === "installPackages",
                );

                if (!toolResult) {
                  throw new Error("Tool result not found");
                }

                const installedPackages = toolResult.args.pkgs;

                currentMessages.push({
                  role: "user",
                  content: `Finished installing the following packages: ${installedPackages.join(
                    ", ",
                  )}`,
                });

                await generate();
                break;
              }
              case "readFiles": {
                const toolResult = toolResults.find(
                  (toolResult) => toolResult.toolName === "readFiles",
                );

                if (!toolResult) {
                  throw new Error("Tool result not found");
                }

                const fileContents = toolResult.args.files;

                currentMessages.push({
                  role: "user",
                  content: `Here are the files:\n${Object.entries(fileContents)
                    .map(
                      ([path, content]) => `${path}\n\`\`\`\n${content}\`\`\``,
                    )
                    .join("\n\n")}`,
                });

                await generate();
                break;
              }
              default: {
                console.log("Unknown tool call");
                break;
              }
            }
          }
        }
      },
    });

    for await (const text of textStream) {
      response += text;

      console.log(text);

      processedResponse = await processStream({
        response,
        processedResponse,
        filePaths,
        filesCache,
        passedEdits,
        failedEdits,
        projectId,
        userId,
        versionId,
        tx,
        machineId,
      });
    }
  }

  await generate();

  const remainingResponse = response.substring(processedResponse.length);

  if (remainingResponse.trim()) {
    processedResponse = await processStream({
      response,
      processedResponse,
      filePaths,
      filesCache,
      passedEdits,
      failedEdits,
      projectId,
      userId,
      versionId,
      tx,
      machineId,
    });
  }

  let finalEditedFiles = {
    passed: passedEdits,
    failed: failedEdits,
  };

  let retryCount = 0;

  while (finalEditedFiles.failed.length > 0) {
    retryCount++;
    console.log(`Retry attempt ${retryCount} for failed edits`, {
      failedCount: finalEditedFiles.failed.length,
    });

    // Add failed edits info to messages
    const failureDetails = finalEditedFiles.failed
      .map((f) => `Failed to edit ${f.edit.path}:\n${f.error}`)
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
    response = "";
    processedResponse = "";
    passedEdits.length = 0;
    failedEdits.length = 0;

    // Generate new response
    await generate();

    // Process any remaining edits from retry
    const remainingRetryResponse = response.substring(processedResponse.length);
    if (remainingRetryResponse.trim()) {
      processedResponse = await processStream({
        response,
        processedResponse,
        filePaths,
        filesCache,
        passedEdits,
        failedEdits,
        projectId,
        userId,
        versionId,
        tx,
        machineId,
      });
    }

    // Update finalEditedFiles with results from this retry
    finalEditedFiles = {
      passed: [...finalEditedFiles.passed, ...passedEdits],
      failed: failedEdits,
    };
  }

  console.log("Coder agent completed", {
    userId,
    projectId,
    passedEdits: finalEditedFiles.passed.length,
    failedEdits: finalEditedFiles.failed.length,
  });
}

function getContext({
  installedPackages,
  availableFiles,
}: {
  installedPackages: InferSelectModel<typeof packages>[];
  availableFiles: (InferSelectModel<typeof files> & {
    declarations: InferSelectModel<typeof declarations>[];
  })[];
}): string {
  return `
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

  Runtime Dependencies:
  ${installedPackages.map((pkg) => `📦 ${pkg.name}`).join("\n")}
  `;
}

async function processStream({
  response,
  processedResponse,
  filePaths,
  filesCache,
  passedEdits,
  failedEdits,
  projectId,
  userId,
  versionId,
  tx,
  machineId,
}: {
  response: string;
  processedResponse: string;
  filePaths: string[];
  filesCache: Record<string, string>;
  passedEdits: Edit[];
  failedEdits: FailedEdit[];
  projectId: string;
  userId: string;
  versionId: string;
  tx: Tx;
  machineId: string;
}): Promise<string> {
  // Get the new content since last processing
  const newContent = response.substring(processedResponse.length);

  // Find complete edit blocks in the new content
  const lines = newContent.split("\n");
  const currentBlock: string[] = [];
  const processedLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue; // Skip undefined lines

    currentBlock.push(line);

    // Check if we have a complete edit block
    if (HEAD.test(line.trim())) {
      // Look ahead for UPDATED pattern to find complete block
      let isComplete = false;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (!nextLine) continue; // Skip undefined lines

        currentBlock.push(nextLine);
        if (UPDATED.test(nextLine.trim())) {
          isComplete = true;
          i = j; // Skip processed lines
          break;
        }
      }

      if (isComplete) {
        try {
          // Process this single complete edit block
          const edit = getEdits({
            content: currentBlock.join("\n"),
            filePaths,
          });

          // Load file if needed
          if (edit.original.trim()) {
            const file = await S3.readFile({
              projectId,
              path: edit.path,
            });

            if (!file) {
              failedEdits.push({
                edit,
                error: `File not found: ${edit.path}`,
              });

              continue;
            }

            filesCache[edit.path] = file;
          }

          // Apply the single edit
          const results = await applyEdit({
            filesCache,
            existingFiles: filePaths,
            edit,
            projectId,
            versionId,
            userId,
            tx,
          });

          // Write the file to the MicroVM
          await Fly.machine.update({
            projectId,
            machineId,
            files: [
              {
                guest_path: edit.path,
                raw_value: Buffer.from(edit.updated).toString("base64"),
              },
            ],
          });

          // Add results to running totals
          if (results.passed) {
            passedEdits.push(results.passed);
          }

          if (results.failed) {
            failedEdits.push(results.failed);
          }
        } catch (error) {
          // If parsing fails, we'll try again with more content
          console.log("Couldn't parse edit block yet, continuing to stream");
        }
      }
    }
  }

  // Return all content up to last successfully processed line
  return response
    .split("\n")
    .slice(0, processedResponse.split("\n").length + processedLines)
    .join("\n");
}

async function processDeclarations({
  content,
  path,
  projectId,
  versionId,
  userId,
  tx,
}: {
  content: string;
  path: string;
  projectId: string;
  versionId: string;
  userId: string;
  tx: Tx;
}) {
  const metadata = await annotator(content);

  console.log("Starting database transaction for file", { path });

  let [insertedFile] = await tx
    .insert(files)
    .values({
      projectId,
      path,
      userId,
    })
    .onConflictDoNothing()
    .returning();

  if (!insertedFile) {
    insertedFile = await tx.query.files.findFirst({
      where: and(eq(files.projectId, projectId), eq(files.path, path)),
    });

    if (!insertedFile) {
      throw new Error(`Failed to insert file ${path}`);
    }
  }

  // Delete existing declarations for this file
  await tx.delete(declarations).where(eq(declarations.fileId, insertedFile.id));

  // Add new declarations
  for (const declaration of metadata) {
    let name = "";

    switch (declaration.type) {
      case "endpoint": {
        switch (declaration.definition.subtype) {
          case "rest": {
            name = `${declaration.definition.method.toUpperCase()}:${declaration.definition.path}`;
            break;
          }
          case "rpc": {
            name = `${declaration.definition.name}`;
            break;
          }
        }
        break;
      }
      case "component": {
        name = declaration.definition.name;
        break;
      }
      case "function":
      case "model":
      case "other": {
        name = declaration.name;
        break;
      }
      default: {
        throw new Error("Unknown declaration type");
      }
    }

    await tx.insert(declarations).values({
      link: `version::${versionId}|file::${insertedFile.path}|declaration::${name}`,
      type: declaration.type,
      projectId,
      fileId: insertedFile.id,
      userId,
      metadata: declaration,
    });
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

const HEAD = /^<{5,9} SEARCH\s*$/;
const DIVIDER = /^={5,9}\s*$/;
const UPDATED = /^>{5,9} REPLACE\s*$/;

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
  // Remove any markdown code block markers and trim
  const potentialFilenames = lines
    .map((line) => line.trim())
    .map((line) => line.replace(/^```\w*/, "").trim())
    .map((line) => line.replace(/```$/, "").trim())
    .filter((line) => line);

  if (!potentialFilenames.length) {
    return null;
  }

  const filename = potentialFilenames[potentialFilenames.length - 1];

  if (!filePaths) {
    return filename || null;
  }

  // Check if filename is in filePaths
  if (filename && filePaths.includes(filename)) {
    return filename;
  }

  // Check if basename matches
  if (!filename) return null;
  const basename = filename.split("/").pop();
  if (!basename) return null;

  const matchingFile = filePaths.find((f) => f.split("/").pop() === basename);
  if (matchingFile) {
    return matchingFile;
  }

  return filename;
}

function getEdits({
  content,
  filePaths,
}: {
  content: string;
  filePaths: string[];
}): Edit {
  // Split content into lines and add newlines
  const lines = content.split("\n").map((line) => `${line}\n`);

  // Find the filename from the content
  const filename = findFilename({
    lines,
    filePaths,
  });

  if (!filename) {
    throw new Error("Missing filename for edit block");
  }

  // Find the edit block
  const startIndex = lines.findIndex((line) => line && HEAD.test(line.trim()));
  if (startIndex === -1) {
    throw new Error("Missing edit block start (<<<<<)");
  }

  // Extract original and updated text sections
  const dividerIndex = lines
    .slice(startIndex + 1)
    .findIndex((line) => line && DIVIDER.test(line.trim()));
  if (dividerIndex === -1) {
    throw new Error("Missing edit block divider (=====)");
  }
  const originalText = lines.slice(
    startIndex + 1,
    startIndex + 1 + dividerIndex,
  );

  const updateStartIndex = startIndex + 1 + dividerIndex + 1;
  const updateEndIndex = lines
    .slice(updateStartIndex)
    .findIndex((line) => line && UPDATED.test(line.trim()));
  if (updateEndIndex === -1) {
    throw new Error("Missing edit block end (>>>>>)");
  }
  const updatedText = lines.slice(
    updateStartIndex,
    updateStartIndex + updateEndIndex,
  );

  return {
    path: filename,
    original: originalText.join(""),
    updated: updatedText.join(""),
  };
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
  filesCache,
  existingFiles,
  edit,
  projectId,
  versionId,
  userId,
  tx,
}: {
  filesCache: Record<string, string>;
  existingFiles: string[];
  edit: Edit;
  projectId: string;
  versionId: string;
  userId: string;
  tx: Tx;
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
      await S3.writeFile({
        projectId,
        path: edit.path,
        content: edit.updated,
      });

      // Process declarations for new file
      await processDeclarations({
        content: edit.updated,
        path: edit.path,
        projectId,
        versionId,
        userId,
        tx,
      });

      return { passed: edit, failed };
    }

    // Handle existing file edits
    const content = filesCache[edit.path];

    if (!content) {
      throw new Error(`File not found: ${edit.path}`);
    }

    const newContent = doReplace({
      content,
      originalText: edit.original,
      updatedText: edit.updated,
    });

    if (newContent) {
      await S3.writeFile({
        projectId,
        path: edit.path,
        content: newContent,
      });

      // Process declarations for updated file
      await processDeclarations({
        content: newContent,
        path: edit.path,
        projectId,
        versionId,
        userId,
        tx,
      });

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
