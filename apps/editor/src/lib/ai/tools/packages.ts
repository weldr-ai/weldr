import { type Tx, and, eq, inArray } from "@weldr/db";
import { packages, versionPackages } from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
import { tool } from "ai";
import { z } from "zod";

export const installPackagesTool = tool({
  description: "Use to install node packages",
  parameters: z.object({
    pkgs: z
      .object({
        type: z.enum(["runtime", "development"]),
        name: z.string(),
        description: z.string().describe("A description of the package"),
      })
      .array(),
  }),
});

export const removePackagesTool = tool({
  description: "Use to remove node packages",
  parameters: z.object({
    pkgs: z.string().array(),
  }),
});

export const executeInstallPackagesTool = async ({
  projectId,
  versionId,
  tx,
  machineId,
  args,
}: {
  projectId: string;
  versionId: string;
  tx: Tx;
  machineId: string;
  args: z.infer<typeof installPackagesTool.parameters>;
}) => {
  console.log(
    `[installPackagesTool:${projectId}] Installing packages`,
    args.pkgs.map((pkg) => pkg.name).join(", "),
  );
  const result: {
    success: boolean;
    error?: string;
    package?: typeof packages.$inferSelect;
  }[] = [];

  const { stderr, exitCode, success } = await Fly.machine.command({
    type: "command",
    projectId,
    machineId,
    command: `cd /workspace && bun add ${args.pkgs.map((pkg) => pkg.name).join(" ")}`,
  });

  if (exitCode !== 0 || !success) {
    return {
      success: false,
      error: stderr || "Failed to install packages",
    };
  }

  const packageDotJson = await Fly.machine.command({
    type: "command",
    projectId,
    machineId,
    command: "cat /workspace/package.json",
  });

  if (
    packageDotJson.exitCode !== 0 ||
    !packageDotJson.stdout ||
    !packageDotJson.success
  ) {
    return {
      success: false,
      error: packageDotJson.stderr,
    };
  }

  const packageDotJsonContent = JSON.parse(packageDotJson.stdout);

  for (const pkg of args.pkgs) {
    const packageVersion =
      packageDotJsonContent.dependencies?.[pkg.name] ??
      packageDotJsonContent.devDependencies?.[pkg.name];

    if (!packageVersion) {
      result.push({
        success: false,
        error: `Could not find package ${pkg.name} in package.json`,
      });

      continue;
    }

    const [insertedPkg] = await tx
      .insert(packages)
      .values({
        projectId,
        name: pkg.name,
        type: pkg.type,
        description: pkg.description,
        version: packageVersion,
      })
      .onConflictDoNothing()
      .returning();

    if (!insertedPkg) {
      throw new Error("Failed to insert package");
    }

    await tx.insert(versionPackages).values({
      versionId,
      packageId: insertedPkg.id,
    });

    result.push({
      success: true,
      package: insertedPkg,
    });
  }

  return result;
};

export const executeRemovePackagesTool = async ({
  projectId,
  versionId,
  installedPackages,
  tx,
  machineId,
  args,
}: {
  projectId: string;
  versionId: string;
  installedPackages: {
    id: string;
    name: string;
    description: string | null;
    type: "runtime" | "development";
  }[];
  tx: Tx;
  machineId: string;
  args: z.infer<typeof removePackagesTool.parameters>;
}) => {
  console.log(
    `[removePackagesTool:${projectId}] Removing packages`,
    args.pkgs.join(", "),
  );

  const { stderr, exitCode, success } = await Fly.machine.command({
    type: "command",
    projectId,
    machineId,
    command: `cd /workspace && bun remove ${args.pkgs.join(" ")}`,
  });

  if (exitCode !== 0 || !success) {
    return {
      success: false,
      error: stderr || "Failed to remove packages",
    };
  }

  const deletedPackages = installedPackages
    .filter((pkg) => args.pkgs.includes(pkg.name))
    .map((pkg) => pkg.id);

  await tx
    .delete(versionPackages)
    .where(
      and(
        inArray(versionPackages.packageId, deletedPackages),
        eq(versionPackages.versionId, versionId),
      ),
    );

  return {
    success: true,
    packages: installedPackages.filter((pkg) => args.pkgs.includes(pkg.name)),
  };
};
