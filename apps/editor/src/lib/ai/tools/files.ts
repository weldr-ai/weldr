import { tool } from "ai";
import { z } from "zod";
import type { FileCache } from "../agents/coder/file-cache";

export const readFilesTool = ({
  projectId,
  fileCache,
}: {
  projectId: string;
  fileCache: FileCache;
}) =>
  tool({
    description: "Use to read files",
    parameters: z.object({
      files: z.string().array(),
    }),
    execute: async ({ files }) => {
      console.log(
        `[readFilesTool:${projectId}] Reading files`,
        files.join(", "),
      );

      const fileContents: Record<string, string> = {};

      for (const file of files) {
        const fileContent = await fileCache.getFile({
          projectId,
          path: file,
        });

        if (!fileContent) {
          throw new Error("File not found");
        }

        fileContents[file] = fileContent;
      }

      return fileContents;
    },
  });

export const deleteFilesTool = ({
  projectId,
}: {
  projectId: string;
}) =>
  tool({
    description: "Use to delete files",
    parameters: z.object({
      files: z.string().array(),
    }),
    execute: async ({ files }) => {
      console.log(
        `[deleteFilesTool:${projectId}] Deleting files`,
        files.join(", "),
      );
      return files;
    },
  });
