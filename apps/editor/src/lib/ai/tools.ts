import type { Tx } from "@weldr/db";
import { packages, versionPackages } from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
import { S3 } from "@weldr/shared/s3";
import { tool } from "ai";
import { z } from "zod";

export const initializeProjectTool = tool({
  description: "Initialize a new project",
  parameters: z.object({
    name: z.string().min(1).describe("The name of the project"),
    addons: z
      .enum(["auth"])
      .array()
      .describe("A list of addons to use for the project"),
    commitMessage: z
      .string()
      .min(1)
      .describe(
        "A commit message for the initial commit of the project. This will be the first commit in the project's history. Must be concise and to the point.",
      ),
    requirements: z
      .string()
      .min(1)
      .describe(
        `Descriptive requirements for the project to be passed to the coder.
        Your requirements and description of the app must be as detailed as possible.
        As the coder will be using your requirements to generate the code, it's very important that you provide as much details as possible.
        MUST NOT hallucinate or make assumptions about the changes requested by the user.
        MUST NOT add anything that is not requested by the user.`,
      ),
    attachments: z
      .string()
      .array()
      .describe(
        "A list of URLs of attachments of images that the have included in their request.",
      )
      .optional(),
  }),
});

export const setupResourceTool = tool({
  description: "Setup the resources for the project",
  parameters: z.object({
    resource: z.enum(["postgres"]).describe("The type of resource to setup"),
  }),
  execute: async () => {
    return {
      status: "pending",
    };
  },
});

export const implementTool = tool({
  description: "Implement the user's request",
  parameters: z.object({
    addons: z
      .enum(["auth"])
      .array()
      .describe("A list of addons to use for the implementation"),
    commitMessage: z
      .string()
      .min(1)
      .describe(
        "A commit message for the changes made to the project. Must be concise and to the point.",
      ),
    requirements: z
      .string()
      .min(1)
      .describe(
        `Descriptive requirements for the changes to be passed to the coder.
        Your requirements and description of the changes must be as detailed as possible.
        As the coder will be using your requirements to generate the code, it's very important that you provide as much details as possible.
        MUST NOT hallucinate or make assumptions about the changes requested by the user.
        MUST NOT add anything that is not requested by the user.`,
      ),
    attachments: z
      .string()
      .array()
      .describe(
        "A list of URLs of attachments of images that the have included in their request.",
      )
      .optional(),
  }),
});

export const installPackagesTool = ({
  projectId,
  machineId,
  versionId,
  tx,
}: {
  projectId: string;
  machineId: string;
  versionId: string;
  tx: Tx;
}) =>
  tool({
    description: "Install node packages",
    parameters: z.object({
      pkgs: z
        .object({
          type: z.enum(["runtime", "development"]),
          name: z.string(),
          reason: z.string(),
        })
        .array(),
    }),
    execute: async ({ pkgs }) => {
      for (const pkg of pkgs) {
        await Fly.machine.executeCommand({
          projectId,
          machineId,
          command: [
            "bun",
            "add",
            pkg.type === "runtime" ? "" : "--dev",
            pkg.name,
          ],
        });

        const [insertedPkg] = await tx
          .insert(packages)
          .values({
            projectId,
            name: pkg.name,
            type: pkg.type,
            reason: pkg.reason,
          })
          .returning();

        if (!insertedPkg) {
          throw new Error("Failed to insert package");
        }

        await tx.insert(versionPackages).values({
          versionId,
          packageId: insertedPkg.id,
        });
      }
    },
  });

export const readFilesTool = ({
  projectId,
  filesCache,
}: {
  projectId: string;
  filesCache: Record<string, string>;
}) =>
  tool({
    description: "Read files contents",
    parameters: z.object({
      files: z.string().array(),
    }),
    execute: async ({ files }) => {
      const fileContents: Record<string, string> = {};

      for (const file of files) {
        if (filesCache[file]) {
          fileContents[file] = filesCache[file];
        } else {
          const fileContent = await S3.readFile({
            projectId,
            path: file,
          });

          if (!fileContent) {
            return "File not found";
          }

          fileContents[file] = fileContent;
        }
      }

      return fileContents;
    },
  });
