import "server-only";

import type { FileCache } from "./file-cache";
import type { Edit, FailedEdit } from "./types";

export const SEARCH = /^<{5,9} SEARCH\s*$/;
export const DIVIDER = /^={5,9}\s*$/;
export const REPLACE = /^>{5,9} REPLACE\s*$/;

export function getEdits({
  content,
}: {
  content: string;
}): Edit[] {
  const lines = content.split("\n");

  return lines.reduce<{
    results: Edit[];
    currentIndex: number;
    currentFilename: string | null;
  }>(
    ({ results, currentFilename }, line, i) => {
      if (!SEARCH.test(line.trim())) {
        return { results, currentIndex: i + 1, currentFilename };
      }

      try {
        // Find filename from previous lines
        const prevLines = lines.slice(Math.max(0, i - 3), i);
        const filename =
          findFilename({
            lines: prevLines,
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
          collectUntilPattern(remainingLines.slice(afterOriginal + 1), REPLACE);

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

export async function applyEdits({
  existingFiles,
  edits,
  projectId,
  fileCache,
}: {
  existingFiles: string[];
  edits: Edit[];
  projectId: string;
  fileCache: FileCache;
}): Promise<{
  passed: Edit[];
  failed: FailedEdit[];
}> {
  console.log(
    `[coder:${projectId}] Applying edits`,
    edits.map((e) => e.path).join(", "),
  );

  // Group edits by file path with proper type safety
  const editsByFile = edits.reduce<Record<string, Edit[]>>((acc, edit) => {
    if (!(edit.path in acc)) {
      acc[edit.path] = [];
    }
    // We know this exists since we just created it if it didn't exist
    (acc[edit.path] as Edit[]).push(edit);
    return acc;
  }, {});

  const passed: Edit[] = [];
  const failed: FailedEdit[] = [];

  // Process each file's edits sequentially
  for (const [filePath, fileEdits] of Object.entries(editsByFile)) {
    // Skip if no edits for this file
    if (fileEdits.length === 0) continue;

    let currentContent: string | null = null;
    // We know this exists since we checked length above
    const firstEdit = fileEdits[0] as Edit;

    // For new files
    if (!firstEdit.original.trim()) {
      if (existingFiles.includes(filePath)) {
        failed.push({
          edit: firstEdit,
          error: `Cannot create ${filePath} - file already exists`,
        });
        continue;
      }
      passed.push(firstEdit);
      continue;
    }

    // Get initial file content
    try {
      const fileContent = await fileCache.getFile({
        projectId,
        path: filePath,
      });

      if (!fileContent) {
        throw new Error(`File not found: ${filePath}`);
      }

      currentContent = fileContent;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      failed.push({
        edit: firstEdit,
        error: `Error reading ${filePath}: ${errorMessage}`,
      });
      continue;
    }

    // Apply edits sequentially
    let hasFailure = false;
    for (const edit of fileEdits) {
      try {
        const newContent = doReplace({
          content: currentContent,
          originalText: edit.original,
          updatedText: edit.updated,
        });

        if (!newContent) {
          let errorMsg = `Failed to apply edit to ${edit.path}\n`;
          errorMsg +=
            "The SEARCH section must exactly match an existing block of lines including all white space, comments, indentation, docstrings, etc\n";

          const similarLines = findSimilarLines({
            searchText: edit.original,
            content: currentContent,
          });
          if (similarLines) {
            errorMsg += `\nDid you mean to match these lines?\n${similarLines}\n`;
          }

          if (
            currentContent.includes(edit.updated.trim()) &&
            edit.updated.trim()
          ) {
            errorMsg += `\nAre you sure you need this SEARCH/REPLACE block?\nThe REPLACE lines are already in ${edit.path}!\n`;
          }

          failed.push({ edit, error: errorMsg });
          hasFailure = true;
          break;
        }

        currentContent = newContent;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        failed.push({
          edit,
          error: `Error processing ${edit.path}: ${errorMessage}`,
        });
        hasFailure = true;
        break;
      }
    }

    // If all edits succeeded, add a single passed result with the final content
    if (!hasFailure && currentContent !== null) {
      passed.push({
        path: filePath,
        original: firstEdit.original,
        updated: currentContent,
      });
    }
  }

  return { passed, failed };
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

export function findFilename({
  lines,
}: {
  lines: string[];
}): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const potentialFilename = lines[i]?.trim();

    // Skip any lines that are SEARCH/REPLACE markers, empty, HTML tags, or special characters
    if (
      !potentialFilename ||
      SEARCH.test(potentialFilename) ||
      REPLACE.test(potentialFilename) ||
      DIVIDER.test(potentialFilename) ||
      potentialFilename.includes(">>>>>") ||
      potentialFilename.includes("<<<<<") ||
      potentialFilename.startsWith("```") ||
      potentialFilename.startsWith("<") || // Skip HTML tags
      potentialFilename.endsWith(">") || // Skip HTML tags
      potentialFilename.includes("**") || // Skip markdown formatting
      /[<>:"|?*]/.test(potentialFilename) // Skip invalid filename characters
    ) {
      continue;
    }

    // Only accept filenames that look like valid paths (common file extensions or proper path format)
    const isValidPath =
      // Must contain a common file extension
      /\.(js|jsx|ts|tsx|css|scss|html|json|md|py|rb|go|rs|java|php|c|cpp|h|swift)$/i.test(
        potentialFilename,
      ) ||
      // Or must be a proper directory/file path (contains / and at least one . in the filename part)
      (potentialFilename.includes("/") &&
        potentialFilename
          .substring(potentialFilename.lastIndexOf("/"))
          .includes("."));

    if (isValidPath) {
      return potentialFilename;
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
