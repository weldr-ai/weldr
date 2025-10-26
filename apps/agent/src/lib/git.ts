import fs from "node:fs/promises";
import simpleGit from "simple-git";

import { Logger } from "@weldr/shared/logger";

import { WORKSPACE_DIR } from "./constants";

const TRUNK_BRANCH = "main";

export namespace Git {
  export class MergeConflictError extends Error {
    constructor(
      public readonly conflicted: string[],
      public readonly sourceBranch: string,
      public readonly targetBranch: string,
    ) {
      super("Merge conflict during squash merge");
    }
  }

  /**
   * Initialize repo on TRUNK_BRANCH with an initial empty commit.
   */
  export async function initRepository(): Promise<void> {
    const logger = Logger.get({
      operation: "git-init",
      repoPath: WORKSPACE_DIR,
    });

    try {
      await fs.mkdir(WORKSPACE_DIR, { recursive: true });

      // Initialize and set trunk branch explicitly
      const git = simpleGit(WORKSPACE_DIR);
      await git.raw(["init", "-b", TRUNK_BRANCH]);

      // Create an initial empty commit so splits/branches have a base
      await git.add(".");
      logger.info("Repository initialized");
    } catch (error) {
      logger.error("Failed to initialize repository", { extra: { error } });
      throw error;
    }
  }

  /**
   * Stages all changes and creates a commit in the repository.
   *
   * @param message - The commit message
   * @param author - The author name for the commit
   * @param email - The author email for the commit
   * @returns The commit hash
   * @throws {Error} When commit creation fails
   */
  export async function commit(
    message: string,
    author: { name: string; email: string },
  ): Promise<string> {
    const logger = Logger.get({ operation: "git-commit" });
    const git = simpleGit(WORKSPACE_DIR);

    try {
      await git.add(".");
      const result = await git.commit(message, undefined, {
        "--author": `${author.name} <${author.email}>`,
      });
      logger.info("Commit created", {
        extra: {
          commit: result.commit,
        },
      });
      return result.commit;
    } catch (error) {
      logger.error("Failed to create commit", { extra: { error, message } });
      throw error;
    }
  }

  /**
   * Create or checkout a branch.
   * @param branchName - The name of the branch to create
   * @param startRef - The starting ref (branch name or commit hash)
   * @returns The workspace directory
   * @throws {Error} When branch creation fails
   */
  export async function checkoutBranch(
    branchName: string,
    startRef?: string,
  ): Promise<string> {
    const logger = Logger.get({
      operation: "git-checkout-branch",
      branchName,
      startRef,
    });

    const git = simpleGit(WORKSPACE_DIR);

    try {
      // Check if branch exists
      const branchExists = await checkBranchExists(branchName);

      if (branchExists) {
        // Branch exists, just checkout
        await git.checkout(branchName);
        logger.info("Checked out existing branch", { extra: { branchName } });
      } else {
        // Branch doesn't exist, create it
        if (!startRef) {
          throw new Error(
            `Branch "${branchName}" does not exist and no startRef was provided`,
          );
        }
        await git.checkoutBranch(branchName, startRef);
        logger.info("Created and checked out new branch", {
          extra: { branchName, startRef },
        });
      }

      return WORKSPACE_DIR;
    } catch (error) {
      logger.error("Failed to checkout branch", { extra: { error } });
      throw error;
    }
  }

  /**
   * Squash-merge source branch onto the target branch.
   * Returns the new commit hash created on the target.
   * @param sourceBranch - The source branch
   * @param targetBranch - The target branch
   * @param message - The message for the commit
   * @param author - The author of the commit
   * @returns The hash of the new commit
   * @throws {Error} When squash merge fails
   */
  export async function squashMerge(
    sourceBranch: string,
    targetBranch: string,
    message: string,
    author: { name: string; email: string },
    opts?: {
      preflightRebase?: boolean;
      fetch?: boolean;
      push?: boolean;
    },
  ): Promise<string> {
    const logger = Logger.get({
      operation: "git-squash-merge",
      sourceBranch,
      targetBranch,
    });

    const git = simpleGit(WORKSPACE_DIR);

    if (opts?.fetch) {
      try {
        await git.fetch();
      } catch {}
    }

    // compute commits that will be squashed (for message + co-authors)
    const commits = await commitsBetween(targetBranch, sourceBranch);
    const coauthors = Array.from(
      new Map(
        commits.map((c) => [
          c.authorEmail,
          { name: c.authorName, email: c.authorEmail },
        ]),
      ).values(),
    );

    const commitMessage = buildSquashMessage({
      message,
      commits: commits.map((c) => ({ title: c.title, hash: c.hash })),
      coauthors,
    });

    // optional: rebase source onto target tip first (reduces conflicts on long-lived branches)
    if (opts?.preflightRebase) {
      try {
        await git.checkout(sourceBranch);
        await git.raw(["rebase", targetBranch]);
      } catch (e) {
        try {
          await git.raw(["rebase", "--abort"]);
        } catch {}
        throw e;
      }
    }

    // Checkout target branch
    await git.checkout(targetBranch);

    // Verify we're on the target branch
    const currentBranch = (
      await git.raw(["rev-parse", "--abbrev-ref", "HEAD"])
    ).trim();
    if (currentBranch !== targetBranch) {
      throw new Error(`Expected to be on ${targetBranch}, on ${currentBranch}`);
    }

    try {
      await git.merge([sourceBranch, "--squash", "--no-commit"]);
    } catch (error) {
      // abort/reset and throw clean error
      const status = await git.status().catch(() => undefined);
      const conflicted = status?.conflicted ?? [];
      try {
        await git.raw(["merge", "--abort"]);
      } catch {
        try {
          await git.raw(["reset", "--merge"]);
        } catch {}
      }
      logger.error("Merge conflict", {
        extra: { conflicted, sourceBranch, targetBranch, error },
      });
      const err = new MergeConflictError(
        conflicted,
        sourceBranch,
        targetBranch,
      );
      throw err;
    }

    // single squash commit, authored by the chosen user
    const { commit } = await git.commit(commitMessage, undefined, {
      "--author": `${author.name} <${author.email}>`,
    });

    if (opts?.push) {
      try {
        await git.push(["-u", "origin", targetBranch]);
      } catch {}
    }

    logger.info("Squash merge completed", { extra: { commit } });
    return commit;
  }

  /**
   * Create a new revert commit in the target branch against the given commit hash.
   * @param targetBranch - The target branch
   * @param commitHash - The hash of the commit to revert
   * @param message - The message for the revert commit
   * @returns The hash of the new revert commit
   * @throws {Error} When revert commit fails
   */
  export async function revert(
    targetBranch: string,
    commitHash: string,
    message?: string,
  ): Promise<string> {
    const logger = Logger.get({
      operation: "git-revert",
      targetBranch,
      commitHash,
    });
    const git = simpleGit(WORKSPACE_DIR);

    try {
      await git.checkout(targetBranch);
      await git.raw(["revert", "--no-edit", commitHash]);
      const { commit } = await git.commit(message ?? `revert: ${commitHash}`);
      logger.info("Revert completed", { extra: { commit } });
      return commit;
    } catch (e) {
      try {
        await git.raw(["revert", "--abort"]);
      } catch {}
      logger.error("Revert failed", { extra: { error: e } });
      throw e;
    }
  }

  /**
   * Get the hash of the head commit.
   * @returns The hash of the head commit
   */
  export async function headCommit(): Promise<string> {
    const git = simpleGit(WORKSPACE_DIR);
    return (await git.revparse(["HEAD"])).trim();
  }

  /**
   * Check if a git repository exists.
   * @returns True if the git repository exists, false otherwise
   */
  export async function hasGitRepository(): Promise<boolean> {
    return await exists(WORKSPACE_DIR);
  }

  /**
   * Check if a path exists.
   * @param p - The path to check
   * @returns True if the path exists, false otherwise
   */
  async function exists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a local branch exists.
   * @param branchName - The name of the branch to check
   * @returns True if the branch exists, false otherwise
   * @throws {Error} When checking for branch existence fails
   */
  async function checkBranchExists(branchName: string): Promise<boolean> {
    const git = simpleGit(WORKSPACE_DIR);
    try {
      // exits 0 if ref exists
      await git.raw(["show-ref", "--verify", `refs/heads/${branchName}`]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the commits between two refs.
   * @param fromRef - The from ref
   * @param toRef - The to ref
   * @returns The commits between the two refs
   */
  async function commitsBetween(
    fromRef: string,
    toRef: string,
  ): Promise<
    Array<{
      hash: string;
      title: string;
      body: string;
      authorName: string;
      authorEmail: string;
    }>
  > {
    const git = simpleGit(WORKSPACE_DIR);
    // commits that are in source but not in target (i.e., target..source)
    const range = `${fromRef}..${toRef}`;
    const format = ["%H", "%s", "%b", "%an", "%ae"].join("%x1f"); // unit sep
    const raw = await git
      .raw(["log", "--no-merges", `--format=${format}`, range])
      .catch(() => "");
    if (!raw.trim()) return [];
    return raw
      .trim()
      .split("\n")
      .map((line) => {
        const [hash, title, body, authorName, authorEmail] = line.split("\x1f");
        return {
          hash: hash ?? "",
          title: title ?? "",
          body: body?.trim() ?? "",
          authorName: authorName ?? "",
          authorEmail: authorEmail ?? "",
        };
      });
  }

  /**
   * Build the squash message.
   * @param opts - The options
   * @returns The squash message
   */
  function buildSquashMessage(opts: {
    message: string;
    commits: Array<{ title: string; hash: string }>;
    coauthors: Array<{ name: string; email: string }>;
  }): string {
    const list =
      opts.commits.length > 0
        ? opts.commits
            .map((c) => `- ${c.title} (${c.hash.slice(0, 7)})`)
            .join("\n")
        : "- No distinct commits (fast squash)";
    const trailers =
      opts.coauthors.length > 0
        ? "\n\n" +
          Array.from(
            new Map(opts.coauthors.map((a) => [a.email, a])) // dedupe by email
              .values(),
          )
            .map((a) => `Co-authored-by: ${a.name} <${a.email}>`)
            .join("\n")
        : "";
    return `${opts.message}\n\n${list}${trailers}`;
  }
}
