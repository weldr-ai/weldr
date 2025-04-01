import type { InferSelectModel, Tx } from "@weldr/db";
import { packages, versionPackages } from "@weldr/db/schema";
import { tool } from "ai";
import { z } from "zod";

export const installPackagesTool = ({
  projectId,
  versionId,
  tx,
}: {
  projectId: string;
  versionId: string;
  tx: Tx;
}) =>
  tool({
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
    execute: async ({ pkgs }) => {
      console.log(
        `[installPackagesTool:${projectId}] Installing packages`,
        pkgs.map((pkg) => pkg.name).join(", "),
      );

      for (const pkg of pkgs) {
        const [insertedPkg] = await tx
          .insert(packages)
          .values({
            projectId,
            name: pkg.name,
            type: pkg.type,
            description: pkg.description,
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
      }

      return pkgs;
    },
  });

export const removePackagesTool = ({
  projectId,
}: {
  projectId: string;
}) =>
  tool({
    description: "Use to remove node packages",
    parameters: z.object({
      pkgs: z.string().array(),
    }),
    execute: async ({ pkgs }) => {
      console.log(
        `[removePackagesTool:${projectId}] Removing packages`,
        pkgs.join(", "),
      );

      return pkgs;
    },
  });

export const readPackageJsonTool = ({
  projectId,
  pkgs,
}: {
  projectId: string;
  pkgs: Omit<InferSelectModel<typeof packages>, "id" | "projectId">[];
}) =>
  tool({
    description: "Use to read package.json",
    parameters: z.object({
      read: z.boolean(),
    }),
    execute: async () => {
      console.log(`[readPackageJsonTool:${projectId}] Reading package.json`);
      const runtimePkgs = pkgs.filter((pkg) => pkg.type === "runtime");
      const devPkgs = pkgs.filter((pkg) => pkg.type === "development");
      return `### Current Installed Packages
- Runtime packages:
${runtimePkgs.map((pkg) => `  - ${pkg.name}`).join("\n")}
- Development packages:
${devPkgs.map((pkg) => `  - ${pkg.name}`).join("\n")}`;
    },
  });
