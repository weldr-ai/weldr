import { WORKSPACE_DIR } from "@/lib/constants";
import { execute } from "@/lib/exec";
import type { AgentRuntimeContext } from "@/mastra";
import type { RuntimeContext } from "@mastra/core/runtime-context";
import { createTool } from "@mastra/core/tools";
import { and, db, eq, inArray } from "@weldr/db";
import { packages, versionPackages } from "@weldr/db/schema";
import { z } from "zod";

const installPackagesInputSchema = z.object({
  pkgs: z
    .object({
      type: z.enum(["runtime", "development"]),
      name: z.string(),
      description: z.string().describe("A description of the package"),
    })
    .array(),
});

export const installPackagesTool = createTool({
  id: "installPackages",
  description: "Use to install node packages",
  inputSchema: installPackagesInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    packages: z
      .array(
        z.object({
          success: z.boolean(),
          error: z.string().optional(),
          package: z
            .object({
              id: z.string(),
              name: z.string(),
              version: z.string(),
              type: z.enum(["runtime", "development"]),
              description: z.string().nullable(),
              projectId: z.string(),
            })
            .optional(),
        }),
      )
      .optional(),
  }),
  execute: async ({
    context,
    runtimeContext,
  }: {
    context: z.infer<typeof installPackagesInputSchema>;
    runtimeContext: RuntimeContext<AgentRuntimeContext>;
  }) => {
    const project = runtimeContext.get("project");
    const version = runtimeContext.get("version");

    console.log(
      `[installPackagesTool:${project.id}] Installing packages`,
      context.pkgs
        .map(
          (pkg: {
            name: string;
            type: "runtime" | "development";
            description: string;
          }) => pkg.name,
        )
        .join(", "),
    );

    const result: {
      success: boolean;
      error?: string;
      package?: typeof packages.$inferSelect;
    }[] = [];

    const { stderr, exitCode, success } = await execute(
      "bun",
      [
        "add",
        ...context.pkgs.map(
          (pkg: {
            name: string;
            type: "runtime" | "development";
            description: string;
          }) => pkg.name,
        ),
      ],
      { cwd: WORKSPACE_DIR },
    );

    if (exitCode !== 0 || !success) {
      return {
        success: false,
        error: stderr || "Failed to install packages",
      };
    }

    const packageDotJson = await execute("cat", [
      `${WORKSPACE_DIR}/package.json`,
    ]);

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

    await db.transaction(async (tx) => {
      for (const pkg of context.pkgs) {
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
            projectId: project.id,
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
          versionId: version.id,
          packageId: insertedPkg.id,
        });

        result.push({
          success: true,
          package: insertedPkg,
        });
      }
    });

    return {
      success: true,
      packages: result,
    };
  },
});

const removePackagesInputSchema = z.object({
  pkgs: z.string().array(),
});

export const removePackagesTool = createTool({
  id: "removePackages",
  description: "Use to remove node packages",
  inputSchema: removePackagesInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    packages: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          type: z.enum(["runtime", "development"]),
        }),
      )
      .optional(),
  }),
  execute: async ({
    context,
    runtimeContext,
  }: {
    context: z.infer<typeof removePackagesInputSchema>;
    runtimeContext: RuntimeContext<AgentRuntimeContext>;
  }) => {
    const project = runtimeContext.get("project");
    const version = runtimeContext.get("version");

    const installedPackages = await db.query.versionPackages
      .findMany({
        where: and(eq(versionPackages.versionId, version.id)),
        with: {
          package: true,
        },
      })
      .then((packages) => packages.map((pkg) => pkg.package));

    console.log(
      `[removePackagesTool:${project.id}] Removing packages`,
      context.pkgs.join(", "),
    );

    const { stderr, exitCode, success } = await execute(
      "bun",
      ["remove", ...context.pkgs],
      { cwd: WORKSPACE_DIR },
    );

    if (exitCode !== 0 || !success) {
      return {
        success: false,
        error: stderr || "Failed to remove packages",
      };
    }

    const deletedPackages = installedPackages
      .filter((pkg) => context.pkgs.includes(pkg.name))
      .map((pkg) => pkg.id);

    await db
      .delete(versionPackages)
      .where(
        and(
          inArray(versionPackages.packageId, deletedPackages),
          eq(versionPackages.versionId, version.id),
        ),
      );

    return {
      success: true,
      packages: installedPackages.filter((pkg) =>
        context.pkgs.includes(pkg.name),
      ),
    };
  },
});
