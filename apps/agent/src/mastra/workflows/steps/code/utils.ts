import { SCRIPTS_DIR, WORKSPACE_DIR } from "@/lib/constants";
import { execute, executeShell } from "@/lib/exec";

export const writeFile = async ({
  projectId,
  filePath,
  content,
}: {
  projectId: string;
  filePath: string;
  content: string;
}) => {
  console.log(`[writeFile:${projectId}] Writing file`, filePath);

  const normalizedPath = filePath.startsWith("/")
    ? filePath.slice(1)
    : filePath;
  const command = `mkdir -p "$(dirname "${filePath}")" && echo "${Buffer.from(content).toString("base64")}" | base64 -d > ${WORKSPACE_DIR}/${normalizedPath}`;

  const { exitCode, success, stderr } = await executeShell(command);

  if ((exitCode === 0 || !stderr) && success) {
    return {
      success: true,
    };
  }

  console.log(
    `[writeFile:${projectId}] Failed to write file`,
    filePath,
    exitCode,
    success,
    stderr,
  );

  return {
    success: false,
    error: stderr || `Failed to write ${WORKSPACE_DIR}/${normalizedPath}`,
  };
};

export const formatAndLint = async ({
  projectId,
}: {
  projectId: string;
}) => {
  console.log(`[formatAndLint:${projectId}] Formatting and linting`);

  const { exitCode, success, stderr } = await execute(
    "bun",
    ["run", "check:fix"],
    { cwd: WORKSPACE_DIR },
  );

  if ((exitCode === 0 || !stderr) && success) {
    return {
      success: true,
    };
  }

  console.log(
    `[formatAndLint:${projectId}] Failed to format and lint`,
    exitCode,
    success,
    stderr,
  );

  return {
    success: false,
    error: stderr || "Failed to format and lint",
  };
};

export const checkTypes = async ({
  projectId,
}: {
  projectId: string;
}) => {
  console.log(`[checkTypes:${projectId}] Checking types`);

  const { exitCode, success, stderr } = await execute(
    "bun",
    ["run", "check-types"],
    { cwd: WORKSPACE_DIR, timeout: 1000 * 60 },
  );

  if ((exitCode === 0 || !stderr) && success) {
    return {
      success: true,
    };
  }

  console.log(
    `[checkTypes:${projectId}] Failed to check types`,
    exitCode,
    success,
    stderr,
  );

  return {
    success: false,
    error: stderr || "Failed to check types",
  };
};

export const commit = async ({
  projectId,
  name = "Weldr",
  email = "noreply@weldr.ai",
  commitMessage,
}: {
  projectId: string;
  name?: string;
  email?: string;
  commitMessage: string;
}) => {
  console.log(`[commit:${projectId}] Committing`, commitMessage);

  const { exitCode, success, stderr } = await execute("bash", [
    `${SCRIPTS_DIR}/commit.sh`,
    commitMessage,
    name,
    email,
  ]);

  if ((exitCode === 0 || !stderr) && success) {
    return {
      success: true,
    };
  }

  console.log(
    `[commit:${projectId}] Failed to commit`,
    exitCode,
    success,
    stderr,
  );

  return {
    success: false,
    error: stderr || "Failed to commit",
  };
};
