import { runCommand, runShellCommand } from "@/ai/utils/commands";
import { SCRIPTS_DIR, WORKSPACE_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";

export const writeFile = async ({
  projectId,
  filePath,
  content,
}: {
  projectId: string;
  filePath: string;
  content: string;
}) => {
  const logger = Logger.get({
    tags: ["writeFile"],
    extra: {
      projectId,
      filePath,
    },
  });

  logger.info(`Writing file: ${filePath}`, {
    extra: {
      contentLength: content.length,
    },
  });

  const normalizedPath = filePath.startsWith("/")
    ? filePath.slice(1)
    : filePath;
  const command = `mkdir -p "$(dirname "${filePath}")" && echo "${Buffer.from(content).toString("base64")}" | base64 -d > ${WORKSPACE_DIR}/${normalizedPath}`;

  const { exitCode, success, stderr } = await runShellCommand(command);

  if ((exitCode === 0 || !stderr) && success) {
    logger.info(`Successfully wrote file: ${filePath}`, {
      extra: {
        normalizedPath,
        contentLength: content.length,
      },
    });
    return {
      success: true,
    };
  }

  logger.error(`Failed to write file: ${filePath}`, {
    extra: {
      normalizedPath,
      exitCode,
      success,
      stderr,
      contentLength: content.length,
    },
  });

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
  const logger = Logger.get({
    tags: ["formatAndLint"],
    extra: {
      projectId,
    },
  });

  logger.info("Starting format and lint process", {
    extra: {
      command: "bun run check:fix",
      workingDirectory: WORKSPACE_DIR,
    },
  });

  const { exitCode, success, stderr } = await runCommand(
    "bun",
    ["run", "check:fix"],
    { cwd: WORKSPACE_DIR },
  );

  if ((exitCode === 0 || !stderr) && success) {
    logger.info("Successfully completed format and lint process", {
      extra: {
        exitCode,
      },
    });
    return {
      success: true,
    };
  }

  logger.error("Format and lint process failed", {
    extra: {
      exitCode,
      success,
      stderr,
      command: "bun run check:fix",
    },
  });

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
  const logger = Logger.get({
    tags: ["checkTypes"],
    extra: {
      projectId,
    },
  });

  logger.info("Starting type checking process", {
    extra: {
      command: "bun run check-types",
      workingDirectory: WORKSPACE_DIR,
      timeout: "60 seconds",
    },
  });

  const { exitCode, success, stderr } = await runCommand(
    "bun",
    ["run", "check-types"],
    { cwd: WORKSPACE_DIR, timeout: 1000 * 60 },
  );

  if ((exitCode === 0 || !stderr) && success) {
    logger.info("Type checking completed successfully", {
      extra: {
        exitCode,
      },
    });
    return {
      success: true,
    };
  }

  logger.error("Type checking failed", {
    extra: {
      exitCode,
      success,
      stderr,
      command: "bun run check-types",
      timeout: "60 seconds",
    },
  });

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
  const logger = Logger.get({
    tags: ["commit"],
    extra: {
      projectId,
    },
  });

  logger.info("Starting git commit process", {
    extra: {
      commitMessage,
      authorName: name,
      authorEmail: email,
      script: `${SCRIPTS_DIR}/commit.sh`,
    },
  });

  const { exitCode, success, stderr } = await runCommand("bash", [
    `${SCRIPTS_DIR}/commit.sh`,
    commitMessage,
    name,
    email,
  ]);

  if ((exitCode === 0 || !stderr) && success) {
    logger.info("Git commit completed successfully", {
      extra: {
        commitMessage,
        authorName: name,
        authorEmail: email,
        exitCode,
      },
    });
    return {
      success: true,
    };
  }

  logger.error("Git commit failed", {
    extra: {
      commitMessage,
      authorName: name,
      authorEmail: email,
      exitCode,
      success,
      stderr,
      script: `${SCRIPTS_DIR}/commit.sh`,
    },
  });

  return {
    success: false,
    error: stderr || "Failed to commit",
  };
};
