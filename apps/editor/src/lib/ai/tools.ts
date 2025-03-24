import { type Tx, and, eq, isNull } from "@weldr/db";
import { files, packages, versionPackages } from "@weldr/db/schema";
import { S3 } from "@weldr/shared/s3";
import { tool } from "ai";
import { z } from "zod";

export const initializeProjectTool = tool({
  description: "Ask the coder agent to initialize a new project",
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
  description: "Ask the user to setup a resource",
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
  description: "Ask the coder agent to implement the changes to the project",
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

export const readFilesTool = ({
  projectId,
}: {
  projectId: string;
}) =>
  tool({
    description: "Use to read files",
    parameters: z.object({
      files: z.string().array(),
    }),
    execute: async ({ files }) => {
      const fileContents: Record<string, string> = {};

      for (const file of files) {
        const fileContent = await S3.readFile({
          projectId,
          path: file,
        });

        if (!fileContent) {
          throw new Error("File not found");
        }

        fileContents[file] = fileContent;
      }

      return fileContents;
    },
  });

export const deleteFilesTool = ({
  projectId,
  tx,
}: {
  projectId: string;
  tx: Tx;
}) =>
  tool({
    description: "Use to delete files",
    parameters: z.object({
      files: z.string().array(),
    }),
    execute: async ({ files: filesToDelete }) => {
      for (const file of filesToDelete) {
        await tx
          .update(files)
          .set({
            deletedAt: new Date(),
          })
          .where(
            and(
              eq(files.path, file),
              isNull(files.deletedAt),
              eq(files.projectId, projectId),
            ),
          );

        await S3.deleteFile({
          projectId,
          path: file,
        });
      }
    },
  });
