import type { TStreamableValue } from "@/types";
import { type InferInsertModel, type Tx, and, eq } from "@weldr/db";
import {
  declarationPackages,
  declarations,
  dependencies,
  files,
  packages,
  presets,
  projects,
  versionDeclarations,
  versionFiles,
  versionPackages,
  versions,
} from "@weldr/db/schema";
import { S3 } from "@weldr/shared/s3";
import { type CoreMessage, tool } from "ai";
import { z } from "zod";
import { coder } from "../agents/coder";
import { insertMessages } from "../insert-messages";

export const initializeProjectTool = tool({
  description:
    "Ask the coder agent to initialize a new project. MUST REPLY WITH A FRIENDLY MESSAGE TO THE USER WHILE INVOKING.",
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
  }),
});

export const initializeProject = async ({
  toolArgs,
  streamWriter,
  tx,
  chatId,
  userId,
  projectId,
  promptMessages,
}: {
  toolArgs: {
    name: string;
    addons: "auth"[];
    commitMessage: string;
    requirements: string;
  };
  streamWriter: WritableStreamDefaultWriter<TStreamableValue>;
  tx: Tx;
  chatId: string;
  userId: string;
  projectId: string;
  promptMessages: CoreMessage[];
}) => {
  console.log(`[initializeProject:${projectId}] Initializing project`);

  const [messageId] = await insertMessages({
    tx,
    input: {
      chatId,
      userId,
      messages: [
        {
          role: "tool",
          rawContent: {
            toolName: "initializeProjectTool",
            toolArgs,
            toolResult: {
              status: "pending",
            },
          },
        },
      ],
    },
  });

  if (!messageId) {
    throw new Error("Message ID not found");
  }

  await streamWriter.write({
    id: messageId,
    type: "tool",
    toolName: "initializeProjectTool",
    toolResult: {
      status: "pending",
    },
  });

  // Get the preset
  console.log(`[initializeProject:${projectId}] Getting preset`);
  const preset = await tx.query.presets.findFirst({
    where: eq(presets.type, "next-base"),
    with: {
      declarations: true,
      files: true,
      packages: true,
    },
  });

  if (!preset) {
    throw new Error("Preset not found");
  }

  // Update the project name
  console.log(`[initializeProject:${projectId}] Updating project name`);
  await tx
    .update(projects)
    .set({
      name: toolArgs.name,
      initiatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  console.log(`[initializeProject:${projectId}] Creating version`);
  // Create a new version
  const [version] = await tx
    .insert(versions)
    .values({
      projectId,
      userId,
      number: 1,
      isCurrent: true,
      message: toolArgs.commitMessage,
    })
    .returning();

  if (!version) {
    throw new Error("Version not found");
  }

  console.log(`[initializeProject:${projectId}] Copying boilerplate files`);
  // Copy boilerplate files to the project
  const fileVersions = await S3.copyBoilerplate({
    boilerplate: "next-base",
    destinationPath: `${projectId}`,
  });

  console.log(`[initializeProject:${projectId}] Inserting files`);
  // Insert files from preset to the project
  const insertedFiles = await tx
    .insert(files)
    .values(
      preset.files.map((file) => ({
        userId,
        projectId,
        path: file.path,
      })),
    )
    .onConflictDoNothing()
    .returning();

  console.log(`[initializeProject:${projectId}] Inserting version files`);
  // Insert version files
  await tx.insert(versionFiles).values(
    insertedFiles.map((file) => {
      const s3VersionId = fileVersions[`${projectId}${file.path}`];

      if (!s3VersionId) {
        throw new Error(
          `[initializeProject:${projectId}] S3 version ID not found for file ${file.path}`,
        );
      }

      return {
        versionId: version.id,
        fileId: file.id,
        s3VersionId,
      };
    }),
  );

  console.log(`[initializeProject:${projectId}] Inserting packages`);
  // Insert packages from preset to the project
  const insertedPkgs = await tx
    .insert(packages)
    .values(
      preset.packages.map((pkg) => ({
        name: pkg.name,
        type: pkg.type,
        projectId,
      })),
    )
    .returning();

  // Insert version packages
  await tx.insert(versionPackages).values(
    insertedPkgs.map((pkg) => ({
      versionId: version.id,
      packageId: pkg.id,
    })),
  );

  console.log(`[initializeProject:${projectId}] Inserting declarations`);
  // Insert declarations from preset to the project
  const insertedDeclarations = await tx
    .insert(declarations)
    .values(
      preset.declarations.map((declaration) => {
        const fileId = insertedFiles.find(
          (file) => file.path === declaration.file,
        )?.id;

        if (!fileId) {
          throw new Error(
            `File ID not found for declaration ${declaration.name}`,
          );
        }

        return {
          name: declaration.name,
          type: declaration.type,
          metadata: declaration.metadata,
          userId,
          projectId,
          fileId,
        } as InferInsertModel<typeof declarations>;
      }),
    )
    .returning();

  // Insert version declarations
  await tx.insert(versionDeclarations).values(
    insertedDeclarations.map((declaration) => ({
      versionId: version.id,
      declarationId: declaration.id,
    })),
  );

  console.log(
    `[initializeProject:${projectId}] Inserting declaration packages and dependencies`,
  );
  // Insert declaration packages and dependencies
  for (const presetDeclaration of preset.declarations) {
    const presetDependencies = presetDeclaration.dependencies;

    if (!presetDependencies) {
      continue;
    }

    // Find the corresponding newly created declaration
    const insertedDeclaration = insertedDeclarations.find(
      (d) =>
        d.name === presetDeclaration.name &&
        d.fileId ===
          insertedFiles.find((file) => file.path === presetDeclaration.file)
            ?.id,
    );

    if (!insertedDeclaration) {
      throw new Error("New declaration not found");
    }

    // Insert node package dependencies
    const pkgs = presetDependencies?.filter(
      (dependency) => dependency.type === "external",
    );

    if (pkgs.length > 0) {
      await tx.insert(declarationPackages).values(
        pkgs.map((pkg) => {
          const insertedPkg = insertedPkgs.find((p) => p.name === pkg.from);

          if (!insertedPkg) {
            throw new Error("Package not found");
          }

          return {
            declarationId: insertedDeclaration.id,
            packageId: insertedPkg.id,
            importPath: pkg.from,
            declarations: pkg.dependsOn,
          } as InferInsertModel<typeof declarationPackages>;
        }),
      );
    }

    // Insert internal dependencies
    const internalDependencies = presetDependencies
      ?.filter((dependency) => dependency.type === "internal")
      .flatMap((dependency) => {
        return dependency.dependsOn.map((dep) => {
          const fileId = insertedFiles.find(
            (file) => file.path === dependency.from,
          )?.id;

          if (!fileId) {
            throw new Error("File ID not found");
          }

          return {
            fileId,
            name: dep,
          };
        });
      });

    if (internalDependencies.length > 0) {
      await tx.insert(dependencies).values(
        internalDependencies.map((dep) => {
          const dependency = insertedDeclarations.find(
            (d) => d.fileId === dep.fileId && d.name === dep.name,
          );

          if (!dependency) {
            throw new Error("Dependency not found");
          }

          return {
            dependentId: insertedDeclaration.id,
            dependentType: insertedDeclaration.type,
            dependencyId: dependency.id,
            dependencyType: dependency.type,
          };
        }),
      );
    }
  }

  const machineId = await coder({
    streamWriter,
    tx,
    chatId,
    projectId,
    versionId: version.id,
    userId,
    promptMessages: [
      ...promptMessages,
      {
        role: "user",
        content: `Please, create this new app: ${toolArgs.requirements}
You MUST NOT create any database schemas or authentication. THIS IS A PURE CLIENT APP.`,
      },
    ],
  });

  console.log(`[initializeProject:${projectId}] Updating status to success`);

  await streamWriter.write({
    id: messageId,
    type: "tool",
    toolName: "initializeProjectTool",
    toolResult: {
      status: "success",
    },
  });

  await streamWriter.write({
    id: version.id,
    type: "version",
    versionId: version.id,
    versionMessage: toolArgs.commitMessage,
    versionNumber: version.number,
    machineId: machineId,
  });

  await insertMessages({
    tx,
    input: {
      chatId,
      userId,
      messages: [
        {
          role: "version",
          rawContent: {
            versionId: version.id,
            versionMessage: toolArgs.commitMessage,
            versionNumber: version.number,
          },
        },
      ],
    },
  });
};
