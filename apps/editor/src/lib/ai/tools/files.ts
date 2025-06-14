import { type Tx, and, eq, inArray } from "@weldr/db";
import { versionFiles } from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
import { tool } from "ai";
import { z } from "zod";

export const listFilesTool = tool({
  description: "Use to list project files",
  parameters: z.object({}),
});

export const readFilesTool = tool({
  description: "Use to read files",
  parameters: z.object({
    files: z.string().array(),
  }),
});

export const deleteFilesTool = tool({
  description: "Use to delete files",
  parameters: z.object({
    files: z.string().array(),
  }),
});

export const executeListFilesTool = async ({
  projectId,
  machineId,
}: {
  projectId: string;
  machineId: string;
}) => {
  const { stdout, stderr, exitCode, success } = await Fly.machine.command({
    type: "command",
    projectId,
    machineId,
    command: "bash /opt/weldr/scripts/project-tree.sh",
  });

  if (exitCode !== 0 || !stdout || !success) {
    return {
      success: false,
      error: stderr || "Failed to get project files",
    };
  }

  return {
    success: true,
    files: stdout,
  };
};

export const executeReadFilesTool = async ({
  projectId,
  machineId,
  args,
}: {
  projectId: string;
  machineId: string;
  args: z.infer<typeof readFilesTool.parameters>;
}) => {
  console.log(
    `[readFilesTool:${projectId}] Reading files`,
    args.files.join(", "),
  );

  const fileContents: Record<string, string> = {};

  // Read all files in a single command using a bash script that outputs each file with a delimiter
  const filesArgs = args.files.map((f) => `/workspace/${f}`).join(" ");
  const command = `for file in ${filesArgs}; do echo "===FILE_START:$(basename "$file")==="; cat "$file" 2>/dev/null || echo "ERROR: Failed to read $file"; echo "===FILE_END==="; done`;

  const { stdout, stderr, exitCode, success } = await Fly.machine.command({
    type: "command",
    projectId,
    machineId,
    command,
  });

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
    const matchingFile = args.files.find(
      (f) => f.endsWith(`/${fileName}`) || f === fileName,
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
};

export const executeDeleteFilesTool = async ({
  projectId,
  versionId,
  existingFiles,
  machineId,
  tx,
  args,
}: {
  projectId: string;
  versionId: string;
  existingFiles: { id: string; path: string }[];
  machineId: string;
  tx: Tx;
  args: z.infer<typeof deleteFilesTool.parameters>;
}) => {
  console.log(
    `[deleteFilesTool:${projectId}] Deleting files`,
    args.files.join(", "),
  );

  const { exitCode, stderr, success } = await Fly.machine.command({
    type: "command",
    projectId,
    machineId,
    command: `rm ${args.files.map((f) => `/workspace/${f}`).join(" ")}`,
  });

  if (exitCode !== 0 || !success) {
    return {
      success: false,
      error: stderr || "Failed to delete files",
    };
  }

  const filesToDelete = existingFiles
    .filter((file) => args.files.includes(file.path))
    .map((file) => file.id);

  await tx
    .delete(versionFiles)
    .where(
      and(
        inArray(versionFiles.fileId, filesToDelete),
        eq(versionFiles.versionId, versionId),
      ),
    );

  return {
    success: true,
    filesDeleted: filesToDelete,
  };
};
