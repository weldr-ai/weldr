import type { Tx } from "@weldr/db";
import { and, eq, isNull } from "@weldr/db";
import { files } from "@weldr/db/schema";
import { S3 } from "@weldr/shared/s3";
import { tool } from "ai";
import { z } from "zod";

export const readFilesTool = ({
  projectId,
}: {
  projectId: string;
}) =>
  tool({
    description: "Use to read files",
    parameters: z.object({
      files: z.string().array(),
    }),
    execute: async ({ files }) => {
      const fileContents: Record<string, string> = {};

      for (const file of files) {
        const fileContent = await S3.readFile({
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
  tx,
}: {
  projectId: string;
  tx: Tx;
}) =>
  tool({
    description: "Use to delete files",
    parameters: z.object({
      files: z.string().array(),
    }),
    execute: async ({ files: filesToDelete }) => {
      for (const file of filesToDelete) {
        await tx
          .update(files)
          .set({
            deletedAt: new Date(),
          })
          .where(
            and(
              eq(files.path, file),
              isNull(files.deletedAt),
              eq(files.projectId, projectId),
            ),
          );

        await S3.deleteFile({
          projectId,
          path: file,
        });
      }

      return filesToDelete;
    },
  });
