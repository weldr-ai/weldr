import { WORKSPACE_DIR } from "@/lib/constants";
import { execute } from "@/lib/exec";
import { DIVIDER, FENCE, REPLACE, SEARCH } from "./constants";
import type { Edit, FailedEdit } from "./types";
import { writeFile } from "./utils";

export function getEdits({
  content,
  mode = "diff",
}: {
  content: string;
  mode?: "diff" | "diff-fenced";
}): Edit[] {
  if (mode === "diff-fenced") {
    return getFencedDiffs({ content });
  }
  return getDiffs({ content });
}

function getDiffs({
  content,
}: {
  content: string;
}): Edit[] {
  const lines = content.split("\n");
  const results: Edit[] = [];
  let currentFilename: string | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line || !SEARCH.test(line.trim())) {
      i++;
      continue;
    }

    try {
      // Find filename from previous lines
      const prevLines = lines.slice(Math.max(0, i - 3), i);
      const filename: string | null =
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

      if (afterUpdated >= remainingLines.length - afterOriginal - 1) {
        throw new Error("Expected >>>>>>> REPLACE");
      }

      const newEdit: Edit = {
        path: filename,
        original: originalLines.join("\n"),
        updated: updatedLines.join("\n"),
      };

      results.push(newEdit);
      currentFilename = filename;

      // Skip past the entire SEARCH/REPLACE block
      i = i + 1 + afterOriginal + 1 + afterUpdated + 1;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Error parsing edit block at line ${i + 1}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  return results;
}

function getFencedDiffs({
  content,
}: {
  content: string;
}): Edit[] {
  const lines = content.split("\n");
  const results: Edit[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line || !FENCE.test(line.trim())) {
      i++;
      continue;
    }

    try {
      // Look for filename on the next line
      if (i + 1 >= lines.length) {
        throw new Error("Expected filename after opening code fence");
      }

      const filename = lines[i + 1]?.trim();
      if (!filename) {
        throw new Error("Missing filename after opening code fence");
      }

      // Find the SEARCH marker
      let searchIndex = -1;
      for (let j = i + 2; j < lines.length; j++) {
        if (SEARCH.test(lines[j]?.trim() || "")) {
          searchIndex = j;
          break;
        }
      }

      if (searchIndex === -1) {
        throw new Error("Expected <<<<<<< SEARCH marker");
      }

      // Get original text
      const remainingLines = lines.slice(searchIndex + 1);
      const { lines: originalLines, newIndex: afterOriginal } =
        collectUntilPattern(remainingLines, DIVIDER);

      if (afterOriginal >= remainingLines.length) {
        throw new Error("Expected =======");
      }

      // Get updated text
      const { lines: updatedLines, newIndex: afterUpdated } =
        collectUntilPattern(remainingLines.slice(afterOriginal + 1), REPLACE);

      if (afterUpdated >= remainingLines.length - afterOriginal - 1) {
        throw new Error("Expected >>>>>>> REPLACE");
      }

      // Find the closing code fence
      const afterReplaceIndex =
        searchIndex + 1 + afterOriginal + 1 + afterUpdated + 1;
      let closingFenceIndex = -1;
      for (let j = afterReplaceIndex; j < lines.length; j++) {
        if (FENCE.test(lines[j]?.trim() || "")) {
          closingFenceIndex = j;
          break;
        }
      }

      if (closingFenceIndex === -1) {
        throw new Error("Expected closing code fence ```");
      }

      const newEdit: Edit = {
        path: filename,
        original: originalLines.join("\n"),
        updated: updatedLines.join("\n"),
      };

      results.push(newEdit);

      // Skip past the entire fenced block
      i = closingFenceIndex + 1;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Error parsing fenced edit block at line ${i + 1}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  return results;
}

export async function applyEdits({
  existingFiles,
  edits,
  projectId,
}: {
  existingFiles: string[];
  edits: Edit[];
  projectId: string;
}): Promise<{
  passed: Edit[];
  failed: FailedEdit[];
}> {
  console.log(
    `[applyEdits:${projectId}] Applying edits`,
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
    let originalFileContent: string | null = null; // Store original file content
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

      const { success } = await writeFile({
        projectId,
        filePath,
        content: firstEdit.updated,
      });

      if (!success) {
        failed.push({
          edit: firstEdit,
          error: `Failed to write ${filePath}`,
        });
        continue;
      }

      passed.push(firstEdit);
      continue;
    }

    // Get initial file content
    try {
      const { stdout, stderr, exitCode, success } = await execute("cat", [
        `${WORKSPACE_DIR}/${filePath}`,
      ]);

      if (exitCode !== 0 || !stdout || !success) {
        console.error(
          `[applyEdits:${projectId}] Failed to read file: ${filePath} ${stderr || "Unknown error"}`,
        );
        throw new Error(
          `[applyEdits:${projectId}] Failed to read file: ${filePath} ${stderr || "Unknown error"}`,
        );
      }

      currentContent = stdout;
      originalFileContent = stdout; // Store the original content
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
    if (
      !hasFailure &&
      currentContent !== null &&
      originalFileContent !== null
    ) {
      const { success } = await writeFile({
        projectId,
        filePath,
        content: currentContent,
      });

      if (!success) {
        failed.push({
          edit: firstEdit,
          error: `Failed to write ${filePath}`,
        });
        continue;
      }

      passed.push({
        path: filePath,
        original: originalFileContent, // Use full original file content
        updated: currentContent,
      });
    }
  }

  return { passed, failed };
}

export function findFilename({
  lines,
}: {
  lines: string[];
}): string | null {
  // Look for the pattern: filename followed by SEARCH/REPLACE block (search backwards)
  for (let i = lines.length - 1; i >= 0; i--) {
    const potentialFilename = lines[i]?.trim();

    // Skip SEARCH/REPLACE/DIVIDER markers and empty lines
    if (
      !potentialFilename ||
      SEARCH.test(potentialFilename) ||
      REPLACE.test(potentialFilename) ||
      DIVIDER.test(potentialFilename)
    ) {
      continue;
    }

    // Check if it looks like a valid file path using regex (allow absolute paths)
    if (!/^\/?\w[\w.\/-]*\/[\w.\/-]+$/.test(potentialFilename)) {
      continue;
    }

    return potentialFilename;
  }

  return null;
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
  const strippedPartLines = partLines.map((line) => line.trimStart());
  const partLen = partLines.length;

  for (let i = 0; i <= wholeLines.length - partLen; i++) {
    const chunk = wholeLines.slice(i, i + partLen);
    const strippedChunk = chunk.map((line) => line.trimStart());

    if (arraysEqual(strippedChunk, strippedPartLines)) {
      // Preserve the original leading whitespace
      const leadingSpaceMatch = chunk[0]?.match(/^\s*/);
      const leadingSpace = leadingSpaceMatch ? leadingSpaceMatch[0] : "";
      const adjustedReplace = replaceLines.map(
        (line) => leadingSpace + line.trimStart(),
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
