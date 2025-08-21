import { spawn } from "node:child_process";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  command: string;
  args: string[];
  duration: number;
  success: boolean;
}

export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  shell?: boolean;
  encoding?: BufferEncoding;
  stdin?: string;
}

/**
 * Execute a command and return detailed information about the execution
 * @param command The command to execute
 * @param args Command arguments
 * @param options Execution options
 * @returns Promise<CommandResult> containing stdout, stderr, exitCode, etc.
 */
export async function runCommand(
  command: string,
  args: string[] = [],
  options: CommandOptions = {},
): Promise<CommandResult> {
  const startTime = Date.now();

  const {
    cwd = process.cwd(),
    env = process.env,
    timeout,
    shell = false,
    encoding = "utf8",
  } = options;

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timeoutId: NodeJS.Timeout | null = null;

    if (options.stdin) {
      child.stdin.write(options.stdin);
      child.stdin.end();
    }

    // Handle timeout
    if (timeout) {
      timeoutId = setTimeout(() => {
        child.kill("SIGTERM");
        // Force kill after 5 seconds if SIGTERM doesn't work
        setTimeout(() => {
          if (!child.killed) {
            child.kill("SIGKILL");
          }
        }, 5000);
      }, timeout);
    }

    // Collect stdout
    if (child.stdout) {
      child.stdout.setEncoding(encoding);
      child.stdout.on("data", (data) => {
        stdout += data;
      });
    }

    // Collect stderr
    if (child.stderr) {
      child.stderr.setEncoding(encoding);
      child.stderr.on("data", (data) => {
        stderr += data;
      });
    }

    // Handle process completion
    child.on("close", (exitCode, signal) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const duration = Date.now() - startTime;
      const result: CommandResult = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
        signal,
        command,
        args,
        duration,
        success: exitCode === 0,
      };

      resolve(result);
    });

    // Handle errors
    child.on("error", (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const duration = Date.now() - startTime;
      const result: CommandResult = {
        stdout: stdout.trim(),
        stderr: error.message,
        exitCode: null,
        signal: null,
        command,
        args,
        duration,
        success: false,
      };

      resolve(result);
    });
  });
}

/**
 * Execute a shell command string (simpler API for shell commands)
 * @param command The shell command string to execute
 * @param options Execution options
 * @returns Promise<CommandResult>
 */
export async function runShell(
  command: string,
  options: Omit<CommandOptions, "shell"> = {},
): Promise<CommandResult> {
  return runCommand(command, [], { ...options, shell: true });
}
