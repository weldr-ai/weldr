import type { User } from "@weldr/auth";
import { Fly } from "@weldr/shared/fly";
import { nanoid } from "@weldr/shared/nanoid";

export const writeFile = async ({
  projectId,
  machineId,
  filePath,
  content,
}: {
  projectId: string;
  machineId: string;
  filePath: string;
  content: string;
}) => {
  const { exitCode, success, stderr } = await Fly.machine.command({
    type: "command",
    projectId,
    machineId,
    command: `mkdir -p "$(dirname "${filePath}")" && echo "${Buffer.from(content).toString("base64")}" | base64 -d > /workspace/${filePath.startsWith("/") ? filePath.slice(1) : filePath}`,
  });

  if ((exitCode === 0 || !stderr) && success) {
    return {
      success: true,
    };
  }

  return {
    success: false,
    error:
      stderr ||
      `Failed to write /workspace/${filePath.startsWith("/") ? filePath.slice(1) : filePath}`,
  };
};

export const formatAndLint = async ({
  projectId,
  machineId,
}: {
  projectId: string;
  machineId: string;
}) => {
  const { exitCode, success, stderr } = await Fly.machine.command({
    type: "command",
    projectId,
    machineId,
    command: "cd /workspace && bun run check:fix",
  });

  if ((exitCode === 0 || !stderr) && success) {
    return {
      success: true,
    };
  }

  return {
    success: false,
    error: stderr || "Failed to format and lint",
  };
};

export const checkTypes = async ({
  projectId,
  machineId,
}: {
  projectId: string;
  machineId: string;
}) => {
  const { exitCode, success, stderr } = await Fly.machine.command({
    type: "job",
    projectId,
    machineId,
    jobId: `check-types-${projectId}-${nanoid()}`,
    command: "cd /workspace && bun run check-types",
  });

  if ((exitCode === 0 || !stderr) && success) {
    return {
      success: true,
    };
  }

  return {
    success: false,
    error: stderr || "Failed to check types",
  };
};

export const commit = async ({
  projectId,
  machineId,
  user,
  commitMessage,
}: {
  projectId: string;
  machineId: string;
  user: User;
  commitMessage: string;
}) => {
  const name = user.name || "Weldr";
  const email = `${user.id}@noreply.weldr.ai`;

  const { exitCode, success, stderr } = await Fly.machine.command({
    type: "command",
    projectId,
    machineId,
    command: `bash /opt/weldr/scripts/commit.sh '${commitMessage}' '${name}' '${email}'`,
  });

  if ((exitCode === 0 || !stderr) && success) {
    return {
      success: true,
    };
  }

  return {
    success: false,
    error: stderr || "Failed to commit",
  };
};
