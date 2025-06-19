import { SCRIPTS_DIR, WORKSPACE_DIR } from "@/lib/constants";
import { execute } from "@/lib/exec";
import { and, db, eq, inArray } from "@weldr/db";
import { versionFiles } from "@weldr/db/schema";
import { z } from "zod";
import { createTool } from "../utils/create-tool";

const listFilesInputSchema = z.object({});

const listFilesOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    fileTree: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export const listFilesTool = createTool({
  description: "Use to list project files",
  inputSchema: listFilesInputSchema,
  outputSchema: listFilesOutputSchema,
  execute: async ({ context }) => {
    const project = context.get("project");

    console.log(`[listFilesTool:${project.id}] Listing files`);

    const { stdout, stderr, exitCode, success } = await execute("bash", [
      `${SCRIPTS_DIR}/project-tree.sh`,
    ]);

    if (exitCode !== 0 || !stdout || !success) {
      return {
        success: false,
        error: stderr || "Failed to get project files",
      };
    }

    return {
      success: true,
      fileTree: stdout,
    };
  },
});

const readFilesInputSchema = z.object({
  files: z.string().array(),
});

const readFilesOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    fileContents: z.record(z.string()),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export const readFilesTool = createTool({
  description: "Use to read files",
  inputSchema: readFilesInputSchema,
  outputSchema: readFilesOutputSchema,
  execute: async ({ input, context }) => {
    const { files } = input;
    const project = context.get("project");

    console.log(
      `[readFilesTool:${project.id}] Reading files`,
      files.join(", "),
    );

    const fileContents: Record<string, string> = {};

    const filesArgs = files
      .map((f: string) => `${WORKSPACE_DIR}/${f}`)
      .join(" ");
    const command = `for file in ${filesArgs}; do echo "===FILE_START:$(basename "$file")==="; cat "$file" 2>/dev/null || echo "ERROR: Failed to read $file"; echo "===FILE_END==="; done`;

    const { stdout, stderr, exitCode, success } = await execute("bash", [
      "-c",
      command,
    ]);

    if (exitCode !== 0 || !stdout || !success) {
      return {
        success: false,
        error: stderr || "Failed to read files",
      };
    }

    const sections = stdout.split("===FILE_START:");

    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      if (!section) continue;

      const fileEndIndex = section.indexOf("===");
      if (fileEndIndex === -1) continue;

      const fileName = section.substring(0, fileEndIndex);
      const contentStart = section.indexOf("===\n") + 4;
      const contentEnd = section.lastIndexOf("===FILE_END===");

      if (contentEnd === -1) continue;

      const content = section.substring(contentStart, contentEnd);

      const matchingFile = files.find(
        (f: string) => f.endsWith(`/${fileName}`) || f === fileName,
      );
      if (matchingFile) {
        if (content.startsWith("ERROR: Failed to read")) {
          return {
            success: false,
            error: `Failed to read file ${matchingFile}`,
          };
        }
        fileContents[matchingFile] = content;
      }
    }

    return {
      success: true,
      fileContents,
    };
  },
});

const deleteFilesInputSchema = z.object({
  files: z.string().array(),
});

const deleteFilesOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    filesDeleted: z.array(z.string()),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export const deleteFilesTool = createTool({
  description: "Use to delete files",
  inputSchema: deleteFilesInputSchema,
  outputSchema: deleteFilesOutputSchema,
  execute: async ({ input, context }) => {
    const { files } = input;
    const project = context.get("project");
    const version = context.get("version");

    const existingFiles = await db.query.versionFiles
      .findMany({
        where: and(
          eq(versionFiles.versionId, version.id),
          inArray(versionFiles.fileId, files),
        ),
        with: {
          file: true,
        },
      })
      .then((files) => files.map((f) => f.file));

    console.log(
      `[deleteFilesTool:${project.id}] Deleting files`,
      files.join(", "),
    );

    const { exitCode, stderr, success } = await execute(
      "rm",
      files.map((f) => `${WORKSPACE_DIR}/${f}`),
    );

    if (exitCode !== 0 || !success) {
      return {
        success: false,
        error: stderr || "Failed to delete files",
      };
    }

    const filesToDelete = existingFiles
      .filter((file) => files.includes(file.path))
      .map((file) => file.id);

    await db
      .delete(versionFiles)
      .where(
        and(
          inArray(versionFiles.fileId, filesToDelete),
          eq(versionFiles.versionId, version.id),
        ),
      );

    return {
      success: true,
      filesDeleted: filesToDelete,
    };
  },
});
