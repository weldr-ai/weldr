import { Fly } from "@weldr/shared/fly";
import { tool } from "ai";
import { z } from "zod";

export const readFilesTool = ({
  projectId,
  machineId,
}: {
  projectId: string;
  machineId: string;
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
        const fileContent = await Fly.machine.readFile({
          projectId,
          machineId,
          path: file,
        });

        if (fileContent.error || !fileContent.content) {
          return {
            error: fileContent.error,
          };
        }

        fileContents[file] = fileContent.content;
      }

      return fileContents;
    },
  });

export const deleteFilesTool = ({
  projectId,
  machineId,
}: {
  projectId: string;
  machineId: string;
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

      const result = await Fly.machine.deleteFile({
        projectId,
        machineId,
        path: files.join(" "),
      });

      if (result.error || !result.success) {
        return {
          error: result.error,
        };
      }

      return files;
    },
  });
