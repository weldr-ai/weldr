import { SCRIPTS_DIR, WORKSPACE_DIR } from "@/lib/constants";
import { execute } from "@/lib/exec";
import type { AgentRuntimeContext } from "@/mastra";
import type { RuntimeContext } from "@mastra/core/runtime-context";
import { createTool } from "@mastra/core/tools";
import { and, db, eq, inArray } from "@weldr/db";
import { versionFiles } from "@weldr/db/schema";
import { z } from "zod";

export const listFilesTool = createTool({
  id: "listFiles",
  description: "Use to list project files",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    fileTree: z.string().optional(),
  }),
  execute: async ({
    runtimeContext,
  }: { runtimeContext: RuntimeContext<AgentRuntimeContext> }) => {
    const project = runtimeContext.get("project");

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

export const readFilesTool = createTool({
  id: "readFiles",
  description: "Use to read files",
  inputSchema: readFilesInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    fileContents: z.record(z.string()).optional(),
  }),
  execute: async ({
    context,
    runtimeContext,
  }: {
    context: z.infer<typeof readFilesInputSchema>;
    runtimeContext: RuntimeContext<AgentRuntimeContext>;
  }) => {
    const project = runtimeContext.get("project");

    console.log(
      `[readFilesTool:${project.id}] Reading files`,
      context.files.join(", "),
    );

    const fileContents: Record<string, string> = {};

    // Read all files in a single command using a bash script that outputs each file with a delimiter
    const filesArgs = context.files
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

    // Parse the output to extract individual file contents
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

      // Find the original file path that matches this basename
      const matchingFile = context.files.find(
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

export const deleteFilesTool = createTool({
  id: "deleteFiles",
  description: "Use to delete files",
  inputSchema: deleteFilesInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    filesDeleted: z.string().array().optional(),
  }),
  execute: async ({
    context,
    runtimeContext,
  }: {
    context: z.infer<typeof deleteFilesInputSchema>;
    runtimeContext: RuntimeContext<AgentRuntimeContext>;
  }) => {
    const project = runtimeContext.get("project");
    const version = runtimeContext.get("version");

    const existingFiles = await db.query.versionFiles
      .findMany({
        where: and(
          eq(versionFiles.versionId, version.id),
          inArray(versionFiles.fileId, context.files),
        ),
        with: {
          file: true,
        },
      })
      .then((files) => files.map((f) => f.file));

    console.log(
      `[deleteFilesTool:${project.id}] Deleting files`,
      context.files.join(", "),
    );

    const { exitCode, stderr, success } = await execute(
      "rm",
      context.files.map((f) => `${WORKSPACE_DIR}/${f}`),
    );

    if (exitCode !== 0 || !success) {
      return {
        success: false,
        error: stderr || "Failed to delete files",
      };
    }

    const filesToDelete = existingFiles
      .filter((file) => context.files.includes(file.path))
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
