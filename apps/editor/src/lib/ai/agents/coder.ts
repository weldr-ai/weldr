import "server-only";

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type CoreMessage, type CoreUserMessage, streamText } from "ai";
import { models } from "../models";
import { prompts } from "../prompts";

interface Edit {
  path: string;
  original: string;
  updated: string;
}

interface FileMap {
  [path: string]: string;
}

export async function coder(prompt: CoreUserMessage, context: string) {
  const currentMessages: CoreMessage[] = [prompt];
  let response = "";

  async function generate() {
    const { textStream } = streamText({
      model: models.claudeSonnet,
      system: prompts.generalCoder(context),
      messages: currentMessages,
      onFinish({ finishReason, text }) {
        if (finishReason === "length") {
          currentMessages.push({
            role: "assistant",
            content: text,
          });
          generate();
        }
      },
    });

    for await (const text of textStream) {
      response += text;
    }
  }

  await generate();

  console.log("--------------- CODER RESPONSE -----------------");
  console.log(response);

  const edits = getEdits(response);

  console.log("--------------- CODER EDITS -----------------");
  console.log(edits);

  const files: FileMap = {};

  console.log("--------------- CODER FILES -----------------");
  console.log(applyEdits(edits, files));

  const editedFiles = applyEdits(edits, files);

  if (process.env.APP_ENV === "development") {
    const tempDir = join(process.cwd(), ".temp", "next-boilerplate");

    for (const [path, content] of Object.entries(editedFiles)) {
      const targetPath = join(tempDir, path);
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, content);
    }
  }

  return editedFiles;
}

const HEAD = /^<{5,9} SEARCH\s*$/m;
const DIVIDER = /^={5,9}\s*$/m;
const UPDATED = /^>{5,9} REPLACE\s*$/m;
const FENCE = "```";

export function getEdits(content: string): Edit[] {
  return findOriginalUpdateBlocks(content);
}

export function applyEdits(edits: Edit[], files: FileMap): FileMap {
  const failed: Edit[] = [];
  const passed: Edit[] = [];
  const updatedFiles = { ...files };

  for (const edit of edits) {
    const { path, original, updated } = edit;
    const content = files[path];

    // If file doesn't exist, create it ONLY if original is empty
    if (!content) {
      if (original.trim() === "") {
        updatedFiles[path] = updated;
        passed.push(edit);
      } else {
        failed.push(edit);
      }
      continue;
    }

    // For existing files, try to apply the edit
    const newContent = doReplace(content, original, updated);

    if (newContent) {
      updatedFiles[path] = newContent;
      passed.push(edit);
    } else {
      failed.push(edit);
    }
  }

  if (failed.length === 0) {
    return updatedFiles;
  }

  const blocks = failed.length === 1 ? "block" : "blocks";
  let errorMessage = `# ${failed.length} SEARCH/REPLACE ${blocks} failed to match!\n`;

  for (const edit of failed) {
    const { path, original, updated } = edit;
    const content = files[path];

    if (!content) {
      errorMessage += `\n## File not found: ${path}\n`;
      continue;
    }

    errorMessage += `
## SearchReplaceNoExactMatch: This SEARCH block failed to exactly match lines in ${path}
<<<<<<< SEARCH
${original}=======
${updated}>>>>>>> REPLACE

`;
    const didYouMean = findSimilarLines(original, content);
    if (didYouMean) {
      errorMessage += `Did you mean to match some of these actual lines from ${path}?

${FENCE}
${didYouMean}
${FENCE}

`;
    }
  }

  throw new Error(errorMessage);
}

function findOriginalUpdateBlocks(content: string): Edit[] {
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
        const prevLines = lines.slice(Math.max(0, i - 3), i);
        const filename = findFilename(prevLines, FENCE) || currentFilename;

        if (!filename) {
          throw new Error("Missing filename before edit block");
        }

        const remainingLines = lines.slice(i + 1);
        const { lines: originalLines, newIndex: afterOriginal } =
          collectUntilPattern(remainingLines, DIVIDER);

        if (afterOriginal >= remainingLines.length) {
          throw new Error("Expected =======");
        }

        const updatedLines = collectUntilPattern(
          remainingLines.slice(afterOriginal + 1),
          UPDATED,
        );

        if (updatedLines.newIndex >= remainingLines.length) {
          throw new Error("Expected >>>>>>> REPLACE");
        }

        const newEdit: Edit = {
          path: filename,
          original: originalLines.join("\n"),
          updated: updatedLines.lines.join("\n"),
        };

        return {
          results: [...results, newEdit],
          currentIndex: i + afterOriginal + updatedLines.newIndex + 2,
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

interface CollectResult {
  lines: string[];
  newIndex: number;
}

function collectUntilPattern(lines: string[], pattern: RegExp): CollectResult {
  const endIndex = lines.findIndex((line) => pattern.test(line.trim()));
  if (endIndex === -1) {
    return { lines: lines, newIndex: lines.length };
  }
  return {
    lines: lines.slice(0, endIndex),
    newIndex: endIndex,
  };
}

function findFilename(lines: string[], fence: string): string | null {
  for (const line of lines.reverse()) {
    const filename = line
      .trim()
      .replace(/^#+\s*/, "") // Remove leading #
      .replace(/^[*`]+/, "") // Remove leading * or `
      .replace(/[*`]+$/, "") // Remove trailing * or `
      .replace(/:$/, "") // Remove trailing :
      .trim();

    if (filename && !line.startsWith(fence)) {
      return filename;
    }
  }
  return null;
}

function doReplace(
  content: string,
  original: string,
  updated: string,
): string | null {
  const ensureNewline = (str: string): string =>
    str.endsWith("\n") ? str : `${str}\n`;

  const preparedContent = ensureNewline(content);
  const preparedOriginal = ensureNewline(original);
  const preparedUpdated = ensureNewline(updated);

  // Try exact match first
  if (preparedContent.includes(preparedOriginal)) {
    return preparedContent.replace(preparedOriginal, preparedUpdated);
  }

  // Try matching without leading whitespace
  const stripLeadingWhitespace = (str: string) =>
    str
      .split("\n")
      .map((line) => line.trimStart())
      .join("\n");

  const strippedContent = stripLeadingWhitespace(preparedContent);
  const strippedOriginal = stripLeadingWhitespace(preparedOriginal);

  if (strippedContent.includes(strippedOriginal)) {
    const startIndex = strippedContent.indexOf(strippedOriginal);
    const endIndex = startIndex + strippedOriginal.length;

    // Get the leading whitespace from the first line of the matched content
    const contentLines = preparedContent.split("\n");
    const matchedLine = contentLines.find(
      (line, i) =>
        stripLeadingWhitespace(line) === strippedOriginal.split("\n")[0],
    );
    const leadingWhitespace = matchedLine
      ? matchedLine.slice(
          0,
          matchedLine.length - matchedLine.trimStart().length,
        )
      : "";

    // Add the same leading whitespace to each line of the updated content
    const indentedUpdate = preparedUpdated
      .split("\n")
      .map((line) => (line.trim() ? leadingWhitespace + line : line))
      .join("\n");

    return (
      preparedContent.slice(0, startIndex) +
      indentedUpdate +
      preparedContent.slice(endIndex)
    );
  }

  return null;
}

function findSimilarLines(
  search: string,
  content: string,
  threshold = 0.6,
): string {
  const searchLines = search.split("\n");
  const contentLines = content.split("\n");

  let bestMatch = "";
  let bestScore = 0;

  for (let i = 0; i < contentLines.length - searchLines.length + 1; i++) {
    const chunk = contentLines.slice(i, i + searchLines.length);
    const score = calculateSimilarity(searchLines.join("\n"), chunk.join("\n"));

    if (score > bestScore) {
      bestScore = score;
      bestMatch = chunk.join("\n");
    }
  }

  return bestScore >= threshold ? bestMatch : "";
}

function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  // Initialize matrix with proper typing
  const matrix: number[][] = Array.from({ length: len1 + 1 }, (_, i) =>
    Array.from({ length: len2 + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        // @ts-expect-error
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // @ts-expect-error
        matrix[i][j] = Math.min(
          // @ts-expect-error
          matrix[i - 1][j] + 1, // deletion
          // @ts-expect-error
          matrix[i][j - 1] + 1, // insertion
          // @ts-expect-error
          matrix[i - 1][j - 1] + 1, // substitution
        );
      }
    }
  }

  const maxLen = Math.max(len1, len2);
  // @ts-expect-error
  const distance = matrix[len1][len2];
  // @ts-expect-error
  return 1 - distance / maxLen;
}
