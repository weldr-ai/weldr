import { WORKSPACE_DIR } from "@/lib/constants";
import { execute } from "@/lib/exec";
import { and, db, eq, inArray } from "@weldr/db";
import { packages, versionPackages } from "@weldr/db/schema";
import { z } from "zod";
import { createTool } from "../utils/create-tool";

const installPackagesInputSchema = z.object({
  pkgs: z
    .object({
      type: z.enum(["runtime", "development"]),
      name: z.string(),
      description: z.string().describe("A description of the package"),
    })
    .array(),
});

const installPackagesOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    packages: z.array(
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
    ),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export const installPackagesTool = createTool({
  description: "Use to install node packages",
  inputSchema: installPackagesInputSchema,
  outputSchema: installPackagesOutputSchema,
  execute: async ({ input, context }) => {
    const project = context.get("project");
    const version = context.get("version");

    console.log(
      `[installPackagesTool:${project.id}] Installing packages`,
      input.pkgs
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
        ...input.pkgs.map(
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
        error: packageDotJson.stderr || "Failed to read package.json",
      };
    }

    const packageDotJsonContent = JSON.parse(packageDotJson.stdout);

    await db.transaction(async (tx) => {
      for (const pkg of input.pkgs) {
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

const removePackagesOutputSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    packages: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        type: z.enum(["runtime", "development"]),
      }),
    ),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

export const removePackagesTool = createTool({
  description: "Use to remove node packages",
  inputSchema: removePackagesInputSchema,
  outputSchema: removePackagesOutputSchema,
  execute: async ({ input, context }) => {
    const project = context.get("project");
    const version = context.get("version");

    const installedPackages = await db.query.versionPackages
      .findMany({
        where: and(eq(versionPackages.versionId, version.id)),
        with: {
          package: true,
        },
      })
      .then((packages) => packages.map((p) => p.package));

    console.log(
      `[removePackagesTool:${project.id}] Removing packages`,
      input.pkgs.join(", "),
    );

    const { stderr, exitCode, success } = await execute(
      "bun",
      ["remove", ...input.pkgs],
      { cwd: WORKSPACE_DIR },
    );

    if (exitCode !== 0 || !success) {
      return {
        success: false,
        error: stderr || "Failed to remove packages",
      };
    }

    const deletedPackageIds = installedPackages
      .filter((pkg): pkg is NonNullable<typeof pkg> => !!pkg)
      .filter((pkg) => input.pkgs.includes(pkg.name))
      .map((pkg) => pkg.id);

    await db
      .delete(versionPackages)
      .where(
        and(
          inArray(versionPackages.packageId, deletedPackageIds),
          eq(versionPackages.versionId, version.id),
        ),
      );

    return {
      success: true,
      packages: installedPackages.filter(
        (pkg): pkg is NonNullable<typeof pkg> =>
          !!pkg && input.pkgs.includes(pkg.name),
      ),
    };
  },
});
