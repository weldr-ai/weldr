import type { Tx } from "@weldr/db";
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

export const removePackagesTool = tool({
  description: "Use to remove node packages",
  parameters: z.object({
    pkgs: z.string().array(),
  }),
  execute: async ({ pkgs }) => {
    return pkgs;
  },
});
