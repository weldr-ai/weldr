import fs from "node:fs/promises";
import path from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";
import { nanoid } from "zod/v4";

import { Logger } from "@weldr/shared/logger";

import { WORKSPACE_DIR } from "./constants";

const WORKTREES_DIR = path.join(WORKSPACE_DIR, ".weldr");
const TRUNK_BRANCH = "main";

export namespace Git {
  /**
   * Initialize repo on TRUNK_BRANCH with an initial empty commit.
   * Also ensures a dedicated worktrees dir and ignores it.
   */
  export async function initRepository(): Promise<void> {
    const logger = Logger.get({
      operation: "git-init",
      repoPath: WORKSPACE_DIR,
    });

    try {
      await fs.mkdir(WORKSPACE_DIR, { recursive: true });
      await fs.mkdir(WORKTREES_DIR, { recursive: true });

      // Initialize and set trunk branch explicitly
      const git = getGit();
      await git.raw(["init", "-b", TRUNK_BRANCH]);

      // Create an initial empty commit so splits/branches have a base
      await git.add(".");
      const hasCommits = await hasAnyCommit(git);
      if (!hasCommits) {
        await git.commit("init: repository");
      }

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
    options?: { worktreeName?: string },
  ): Promise<string> {
    const logger = Logger.get({ operation: "git-commit" });
    const git = getGit(options?.worktreeName);

    try {
      await git.add(".");
      const result = await git.commit(message, undefined, {
        "--author": `${author.name} <${author.email}>`,
      });
      logger.info("Commit created", {
        extra: {
          commit: result.commit,
          worktree: options?.worktreeName ?? "root",
        },
      });
      return result.commit;
    } catch (error) {
      logger.error("Failed to create commit", { extra: { error, message } });
      throw error;
    }
  }

  /**
   * Create a new worktree backed by a new branch that starts from startRef (branch or commit).
   * The directory name is independent from the Git ref (use your branchId for both ideally).
   * @param worktreeName - The name of the worktree to create
   * @param branchName - The name of the branch to create
   * @param startRef - The starting ref (branch name or commit hash)
   * @returns The path to the worktree
   * @throws {Error} When worktree creation fails
   */
  export async function getOrCreateWorktree(
    worktreeName: string,
    branchName: string,
    startRef: string,
  ): Promise<string> {
    const logger = Logger.get({
      operation: "git-get-or-create-worktree",
      worktreeName,
      branchName,
      startRef,
    });

    const git = getGit();
    const worktreePath = path.join(WORKTREES_DIR, worktreeName);

    // Case 1: a worktree dir with this name already exists → return it
    if (await exists(worktreePath)) {
      const wts = await listWorktrees();
      const wt = wts.find((w) => w.path === worktreePath);
      if (wt?.branch && refShortName(wt.branch) !== branchName) {
        throw new Error(
          `Worktree "${worktreeName}" already exists but is attached to a different branch ` +
            `("${refShortName(wt.branch)}" ≠ "${branchName}")`,
        );
      }
      logger.info("Worktree already present (dir exists)", {
        extra: { worktreePath },
      });
      return worktreePath;
    }

    // Case 2: this branch is already attached to some other worktree → reuse that
    const existingPath = await findWorktreeByBranch(branchName);
    if (existingPath) {
      logger.info("Branch already attached to a worktree; reusing", {
        extra: { existingPath },
      });
      return existingPath;
    }

    // Case 3: ensure branch exists locally; if not, create it at startRef
    await ensureLocalBranchFromRef(branchName, startRef);

    // Case 4: attach a brand new worktree to this branch
    await fs.mkdir(WORKTREES_DIR, { recursive: true });
    await git.raw(["worktree", "add", worktreePath, branchName]);

    logger.info("Worktree attached", { extra: { worktreePath } });
    return worktreePath;
  }

  /**
   * Remove a worktree.
   * @param worktreeName - The name of the worktree to delete
   * @returns void
   * @throws {Error} When worktree deletion fails
   */
  export async function deleteWorktree(worktreeName: string): Promise<void> {
    const logger = Logger.get({
      operation: "git-remove-worktree",
      worktreeName,
    });
    const git = getGit();
    const worktreePath = path.join(WORKTREES_DIR, worktreeName);

    try {
      if (await exists(worktreePath)) {
        await git.raw(["worktree", "remove", worktreePath, "--force"]);
        logger.info("Worktree removed", { extra: { worktreePath } });
      }

      // prune leftover admin data
      await git.raw(["worktree", "prune"]).catch(() => void 0);
    } catch (error) {
      logger.error("Failed to remove worktree", { extra: { error } });
      throw error;
    }
  }

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
   * Squash-apply source branch (from its worktree) onto the target worktree.
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
    const root = getGit();
    if (opts?.fetch) {
      // optional: fetch to ensure local tips are current
      try {
        await root.fetch();
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
      await withTempWorktree(sourceBranch, async (srcGit) => {
        try {
          await srcGit.raw(["rebase", targetBranch]);
        } catch (e) {
          try {
            await srcGit.raw(["rebase", "--abort"]);
          } catch {}
          throw e;
        }
        return;
      });
    }

    // Do the squash on the target's tip
    const newSha = await withTempWorktree(targetBranch, async (tgtGit) => {
      // sanity: we're on target
      const cur = (
        await tgtGit.raw(["rev-parse", "--abbrev-ref", "HEAD"])
      ).trim();
      if (cur !== targetBranch)
        throw new Error(`Expected to be on ${targetBranch}, on ${cur}`);

      try {
        await tgtGit.merge([sourceBranch, "--squash", "--no-commit"]);
      } catch (error) {
        // abort/reset and throw clean error
        const status = await tgtGit.status().catch(() => undefined);
        const conflicted = status?.conflicted ?? [];
        try {
          await tgtGit.raw(["merge", "--abort"]);
        } catch {
          try {
            await tgtGit.raw(["reset", "--merge"]);
          } catch {}
        }
        Logger.error("Merge conflict", {
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
      const { commit } = await tgtGit.commit(commitMessage, undefined, {
        "--author": `${author.name} <${author.email}>`,
      });

      return commit;
    });

    if (opts?.push) {
      // push only the target branch; this matches GH "Update target with a squash commit"
      try {
        await root.push(["-u", "origin", targetBranch]);
      } catch {}
    }

    return newSha;
  }

  /**
   * Pick winner: squash winner into target, then delete (winner + provided siblings).
   * IMPORTANT: pass siblings from DB (variant group). If omitted, no siblings are deleted.
   * @param winnerBranch - The branch of the winner
   * @param targetBranch - The target branch
   * @param message - The message for the commit
   * @param author - The author of the commit
   * @param loserBranchNames - The branches of the siblings to delete
   * @returns The hash of the new commit
   * @throws {Error} When pick winner branch fails
   */
  export async function pickWinnerBranch(
    winnerBranch: string,
    targetBranch: string,
    message: string,
    author: { name: string; email: string },
    loserBranchNames?: string[],
  ): Promise<string> {
    const hash = await squashMerge(winnerBranch, targetBranch, message, author);
    if (loserBranchNames?.length) {
      await Promise.all(
        loserBranchNames.map((n) => deleteWorktree(n).catch(() => {})),
      );
    }
    return hash;
  }

  /**
   * Rebase the source worktree's branch onto the given ref (branch or commit).
   * Returns new HEAD hash of the source worktree.
   * @param sourceBranch - The source branch
   * @param ontoRef - The ref to rebase onto
   * @returns The hash of the new HEAD
   * @throws {Error} When rebase branch onto fails
   */
  export async function rebaseBranchOntoRef(
    sourceBranch: string,
    ontoRef: string,
  ): Promise<string> {
    return withTempWorktree(sourceBranch, async (srcGit) => {
      try {
        await srcGit.raw(["rebase", ontoRef]);
      } catch (e) {
        try {
          await srcGit.raw(["rebase", "--abort"]);
        } catch {}
        throw e;
      }
      return (await srcGit.revparse(["HEAD"])).trim();
    });
  }

  /**
   * Create a new revert commit in the target worktree against the given commit hash.
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
    return withTempWorktree(targetBranch, async (tgtGit) => {
      try {
        await tgtGit.raw(["revert", "--no-edit", commitHash]);
      } catch (e) {
        try {
          await tgtGit.raw(["revert", "--abort"]);
        } catch {}
        throw e;
      }
      const { commit } = await tgtGit.commit(
        message ?? `revert: ${commitHash}`,
      );
      return commit;
    });
  }

  /**
   * Create a detached worktree for previewing any commit hash (no branch).
   * Returns the created worktree path.
   * @param commitHash - The hash of the commit to create a detached preview for
   * @returns The path to the detached preview
   * @throws {Error} When detached preview creation fails
   */
  export async function createDetachedPreview(
    commitHash: string,
  ): Promise<string> {
    const logger = Logger.get({
      operation: "git-detached-preview",
      commit: commitHash,
    });
    const git = getGit();
    const name = `p_${commitHash.slice(0, 8)}`;
    const worktreePath = path.join(WORKTREES_DIR, name);

    try {
      await fs.mkdir(WORKTREES_DIR, { recursive: true });
      await git.raw(["worktree", "add", "--detach", worktreePath, commitHash]);
      logger.info("Detached preview created", { extra: { worktreePath } });
      return worktreePath;
    } catch (error) {
      logger.error("Failed to create detached preview", { extra: { error } });
      throw error;
    }
  }

  function getGit(worktreeName?: string): SimpleGit {
    const dir = worktreeName
      ? path.join(WORKTREES_DIR, worktreeName)
      : WORKSPACE_DIR;
    return simpleGit(dir);
  }

  export async function headCommit(worktreeName?: string): Promise<string> {
    const git = getGit(worktreeName);
    return (await git.revparse(["HEAD"])).trim();
  }

  export async function branchNameForWorktree(
    worktreeName: string,
  ): Promise<string | undefined> {
    const worktrees = await listWorktrees();
    const wt = worktrees.find((w) => path.basename(w.path) === worktreeName);
    return wt?.branch ? refShortName(wt.branch) : undefined;
  }

  export async function worktreeNameForBranch(
    branchName: string,
  ): Promise<string | undefined> {
    const worktrees = await listWorktrees();
    const wt = worktrees.find(
      (w) => refShortName(w.branch ?? "") === branchName,
    );
    return wt ? path.basename(wt.path) : undefined;
  }

  /**
   * Parse `git worktree list --porcelain`. Handles attached and detached worktrees.
   * @returns The list of worktrees
   * @throws {Error} When worktree listing fails
   */
  export async function listWorktrees(): Promise<
    Array<{ path: string; branch?: string; commit: string; name: string }>
  > {
    const logger = Logger.get({ operation: "git-list-worktrees" });
    const git = getGit();

    try {
      const output = await git.raw(["worktree", "list", "--porcelain"]);
      const worktrees: Array<{
        path: string;
        branch?: string;
        commit: string;
        name: string;
      }> = [];

      type WT = Partial<{ path: string; branch: string; commit: string }>;
      let current: WT = {};

      for (const raw of output.split("\n")) {
        if (raw.startsWith("worktree ")) {
          if (current.path && current.commit) {
            worktrees.push({
              path: current.path,
              branch: current.branch,
              commit: current.commit,
              name: path.basename(current.path),
            });
          }
          current = { path: raw.substring(9) };
        } else if (raw.startsWith("HEAD ")) {
          current.commit = raw.substring(5);
        } else if (raw.startsWith("branch ")) {
          current.branch = raw.substring(7);
        }
      }
      if (current.path && current.commit) {
        worktrees.push({
          path: current.path,
          branch: current.branch,
          commit: current.commit,
          name: path.basename(current.path),
        });
      }

      logger.info("Listed worktrees", { extra: { count: worktrees.length } });
      return worktrees;
    } catch (error) {
      logger.error("Failed to list worktrees", { extra: { error } });
      throw error;
    }
  }

  /**
   * Remove the `refs/heads/` prefix from a ref name.
   * @param ref - The ref name
   * @returns The ref name without the `refs/heads/` prefix
   */
  function refShortName(ref: string): string {
    return ref.replace(/^refs\/heads\//, "");
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
   * Check if a git instance has any commits.
   * @param git - The git instance
   * @returns True if the git instance has any commits, false otherwise
   * @throws {Error} When checking for commits fails
   */
  async function hasAnyCommit(git: SimpleGit): Promise<boolean> {
    try {
      // Returns 0 when HEAD exists; throws before first commit
      await git.raw(["rev-parse", "--verify", "HEAD"]);
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
  async function branchExists(branchName: string): Promise<boolean> {
    const git = getGit();
    try {
      // exits 0 if ref exists
      await git.raw(["show-ref", "--verify", `refs/heads/${branchName}`]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find a worktree by branch name.
   * @param branchName - The name of the branch to find
   * @returns The path to the worktree, or undefined if not found
   * @throws {Error} When finding worktree by branch name fails
   */
  async function findWorktreeByBranch(
    branchName: string,
  ): Promise<string | undefined> {
    const wts = await listWorktrees();
    const wt = wts.find(
      (w) => w.branch && w.branch.replace("refs/heads/", "") === branchName,
    );
    return wt ? wt.path : undefined;
  }

  /**
   * Ensure a local branch exists at startRef (commit or branch).
   * @param branchName - The name of the branch to create
   * @param startRef - The starting ref (commit or branch)
   * @returns void
   * @throws {Error} When ensuring local branch exists fails
   */
  async function ensureLocalBranchFromRef(
    branchName: string,
    startRef?: string,
  ): Promise<void> {
    const git = getGit();
    if (await branchExists(branchName)) return;

    if (!startRef) {
      throw new Error(
        `Branch "${branchName}" does not exist and no startRef was provided`,
      );
    }

    await git.raw(["branch", branchName, startRef]);
  }

  /**
   * Execute a function with a temporary worktree.
   * @param branchName - The name of the branch to create
   * @param fn - The function to execute
   * @returns The result of the function
   * @throws {Error} When executing the function fails
   */
  async function withTempWorktree<T>(
    branchName: string,
    fn: (git: SimpleGit, worktreePath: string) => Promise<T>,
  ): Promise<T> {
    const git = getGit(); // root repo
    const tmp = `ops_${branchName.replace(/[^\w.-]/g, "_")}_${nanoid()}`;
    const worktreePath = path.join(WORKTREES_DIR, tmp);

    try {
      await fs.mkdir(WORKTREES_DIR, { recursive: true });
      // attach a clean worktree for the branch (no -b; branch must exist)
      await git.raw(["worktree", "add", worktreePath, branchName]);

      const wtGit = getGit(tmp);
      return await fn(wtGit, worktreePath);
    } finally {
      // best-effort cleanup
      try {
        await git.raw(["worktree", "remove", worktreePath, "--force"]);
      } catch {}
      try {
        await git.raw(["worktree", "prune"]);
      } catch {}
    }
  }

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
    const git = getGit();
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
