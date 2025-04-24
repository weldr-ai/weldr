import type { Tx } from "@weldr/db";
import { packages, versionPackages } from "@weldr/db/schema";
import { tool } from "ai";
import { z } from "zod";
import { getPackageVersion } from "../agents/coder/utils";

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
      const result: {
        success: boolean;
        error?: string;
        package?: typeof packages.$inferSelect;
      }[] = [];

      for (const pkg of pkgs) {
        const packageVersion = await getPackageVersion(pkg.name);

        if (!packageVersion) {
          result.push({
            success: false,
            error: "Could not find package on npm",
          });
        } else {
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
      }

      return result;
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
