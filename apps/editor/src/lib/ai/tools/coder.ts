import { takeScreenshot } from "@/lib/take-screenshot";
import type { TStreamableValue } from "@/types";
import { and, db, eq, not } from "@weldr/db";
import {
  declarationPackages,
  declarations,
  dependencies,
  files,
  packages,
  presets,
  projects,
  themes,
  versionDeclarations,
  versionFiles,
  versionPackages,
  versions,
} from "@weldr/db/schema";
import { S3 } from "@weldr/shared/s3";
import { type CoreMessage, tool } from "ai";
import { z } from "zod";
import { coder } from "../agents/coder";
import { deploy } from "../agents/coder/deploy";
import { enrich } from "../agents/coder/enrich";

export const coderTool = tool({
  description:
    "Ask the coder agent to implement the request. MUST BE CALLED AFTER THE USER HAS PROVIDED THE REQUIREMENTS.",
  parameters: z.object({
    name: z
      .string()
      .nullable()
      .optional()
      .describe("The name of the project if it's a new project."),
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
  }),
});

export const executeCoderTool = async ({
  chatId,
  userId,
  projectId,
  promptMessages,
  streamWriter,
  toolArgs,
}: {
  chatId: string;
  userId: string;
  projectId: string;
  promptMessages: CoreMessage[];
  streamWriter: WritableStreamDefaultWriter<TStreamableValue>;
  toolArgs: z.infer<typeof coderTool.parameters>;
}) => {
  let version = await db.query.versions.findFirst({
    where: and(
      eq(versions.projectId, projectId),
      eq(versions.isCurrent, true),
      not(eq(versions.progress, "succeeded")),
    ),
  });

  if (!version) {
    version = await initializeVersion({
      projectId,
      userId,
      toolArgs,
    });
  }

  let versionStatus = version.progress;

  console.log(
    `[coderTool:${projectId}] Implementing project with status ${versionStatus}`,
  );

  if (versionStatus === "initiated") {
    console.log(`[coderTool:${projectId}] Invoking coder`);
    await streamWriter.write({
      type: "coder",
      status: "initiated",
    });
    await coder({
      streamWriter,
      chatId,
      projectId,
      version,
      userId,
      promptMessages: [
        ...promptMessages,
        {
          role: "user",
          content: `Please, create the following: ${toolArgs.requirements}
  You MUST NOT create any database schemas or authentication. THIS IS A PURE CLIENT APP.`,
        },
      ],
    });
    versionStatus = "coded";
    console.log(`[coderTool:${projectId}] Coder finished`);
    await streamWriter.write({
      type: "coder",
      status: "coded",
    });
  }

  if (versionStatus === "coded") {
    console.log(`[coderTool:${projectId}] Invoking deploy`);
    const machineId = await deploy({
      projectId,
      versionId: version.id,
    });
    versionStatus = "deployed";
    console.log(`[coderTool:${projectId}] Deploy finished`);
    await streamWriter.write({
      type: "coder",
      status: "deployed",
      machineId,
    });
  }

  if (versionStatus === "deployed") {
    console.log(`[coderTool:${projectId}] Invoking enrichment`);
    await enrich({
      projectId,
      versionId: version.id,
      streamWriter,
      userId,
    });
    versionStatus = "enriched";
    await streamWriter.write({
      type: "coder",
      status: "enriched",
    });
  }

  if (versionStatus === "enriched") {
    console.log(`[coderTool:${projectId}] Taking screenshot`);
    await takeScreenshot({
      versionId: version.id,
      projectId,
    });
    await db
      .update(versions)
      .set({
        progress: "succeeded",
      })
      .where(eq(versions.id, version.id));
    versionStatus = "succeeded";
    await streamWriter.write({
      type: "coder",
      status: "succeeded",
    });
  }
};

const initializeVersion = async ({
  projectId,
  userId,
  toolArgs,
}: {
  projectId: string;
  userId: string;
  toolArgs: z.infer<typeof coderTool.parameters>;
}): Promise<typeof versions.$inferSelect> => {
  return db.transaction(async (tx) => {
    const project = await tx.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
    });

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.initiatedAt) {
      console.log(`[coderTool:${projectId}] Getting previous version...`);
      const previousVersion = await tx.query.versions.findFirst({
        where: and(
          eq(versions.projectId, projectId),
          eq(versions.userId, userId),
          eq(versions.isCurrent, true),
        ),
        columns: {
          id: true,
          number: true,
          themeId: true,
        },
        with: {
          files: true,
          packages: true,
          declarations: true,
        },
      });

      if (!previousVersion) {
        throw new Error("Version not found");
      }

      console.log(`[coderTool:${projectId}] Getting latest version number...`);
      const latestNumber = await tx.query.versions.findFirst({
        where: eq(versions.projectId, projectId),
        orderBy: (versions, { desc }) => [desc(versions.number)],
        columns: {
          number: true,
        },
      });

      if (!latestNumber) {
        throw new Error("Latest version not found");
      }

      console.log(`[coderTool:${projectId}] Updating previous versions...`);
      await tx
        .update(versions)
        .set({
          isCurrent: false,
        })
        .where(
          and(eq(versions.projectId, projectId), eq(versions.userId, userId)),
        );

      console.log(`[coderTool:${projectId}] Creating new version...`);
      const [version] = await tx
        .insert(versions)
        .values({
          projectId,
          userId,
          number: latestNumber.number + 1,
          isCurrent: true,
          parentVersionId: previousVersion.id,
          message: toolArgs.commitMessage,
          description: toolArgs.requirements,
          themeId: previousVersion.themeId,
        })
        .returning();

      if (!version) {
        throw new Error("Version not found");
      }

      console.log(
        `[coderTool:${projectId}] Copying ${previousVersion.files.length} files...`,
      );
      await tx.insert(versionFiles).values(
        previousVersion.files.map((file) => ({
          versionId: version.id,
          fileId: file.fileId,
          s3VersionId: file.s3VersionId,
        })),
      );

      console.log(
        `[coderTool:${projectId}] Copying ${previousVersion.packages.length} packages...`,
      );
      await tx.insert(versionPackages).values(
        previousVersion.packages.map((pkg) => ({
          versionId: version.id,
          packageId: pkg.packageId,
        })),
      );

      console.log(
        `[coderTool:${projectId}] Copying ${previousVersion.declarations.length} declarations...`,
      );
      await tx.insert(versionDeclarations).values(
        previousVersion.declarations.map((declaration) => ({
          versionId: version.id,
          declarationId: declaration.declarationId,
        })),
      );

      return version;
    }

    console.log(`[coderTool:${projectId}] Getting preset`);
    const preset = await tx.query.presets.findFirst({
      where: eq(presets.type, "base"),
      with: {
        declarations: true,
        files: true,
        packages: true,
      },
    });

    if (!preset) {
      throw new Error("Preset not found");
    }

    console.log(`[coderTool:${projectId}] Updating project name`);
    await tx
      .update(projects)
      .set({
        name: toolArgs.name,
        initiatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

    const presetThemes = await tx.query.presetThemes.findMany();

    const randomNumber = Math.floor(Math.random() * presetThemes.length);

    const presetTheme = presetThemes[randomNumber];

    if (!presetTheme) {
      throw new Error("Theme not found");
    }

    const [projectTheme] = await tx
      .insert(themes)
      .values({
        data: presetTheme.data,
        userId,
        projectId,
      })
      .returning();

    if (!projectTheme) {
      throw new Error("Project theme not found");
    }

    console.log(`[coderTool:${projectId}] Creating version`);
    const [version] = await tx
      .insert(versions)
      .values({
        projectId,
        userId,
        number: 1,
        isCurrent: true,
        message: toolArgs.commitMessage,
        description: toolArgs.requirements,
        themeId: projectTheme.id,
      })
      .returning();

    if (!version) {
      throw new Error("Version not found");
    }

    console.log(`[coderTool:${projectId}] Copying boilerplate files`);
    const fileVersions = await S3.copyBoilerplate({
      boilerplate: preset.type,
      destinationPath: `${projectId}`,
    });

    console.log(`[coderTool:${projectId}] Inserting files`);
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

    console.log(`[coderTool:${projectId}] Inserting version files`);
    await tx.insert(versionFiles).values(
      insertedFiles.map((file) => {
        console.log(
          `${projectId}${file.path.startsWith("/") ? file.path : `/${file.path}`}`,
        );

        const s3VersionId =
          fileVersions[
            `${projectId}${file.path.startsWith("/") ? file.path : `/${file.path}`}`
          ];
        if (!s3VersionId) {
          throw new Error(
            `[coderTool:${projectId}] S3 version ID not found for file ${file.path}`,
          );
        }

        return {
          versionId: version.id,
          fileId: file.id,
          s3VersionId,
        };
      }),
    );

    console.log(`[coderTool:${projectId}] Inserting packages`);
    const insertedPkgs = await tx
      .insert(packages)
      .values(
        preset.packages.map((pkg) => ({
          name: pkg.name,
          type: pkg.type,
          version: pkg.version,
          projectId,
        })),
      )
      .returning();

    await tx.insert(versionPackages).values(
      insertedPkgs.map((pkg) => ({
        versionId: version.id,
        packageId: pkg.id,
      })),
    );

    console.log(`[coderTool:${projectId}] Inserting declarations`);
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
            specs: declaration.specs,
            userId,
            projectId,
            fileId,
          } as typeof declarations.$inferInsert;
        }),
      )
      .returning();

    await tx.insert(versionDeclarations).values(
      insertedDeclarations.map((declaration) => ({
        versionId: version.id,
        declarationId: declaration.id,
      })),
    );

    console.log(
      `[coderTool:${projectId}] Inserting declaration packages and dependencies`,
    );
    for (const presetDeclaration of preset.declarations) {
      const presetDependencies = presetDeclaration.dependencies;
      if (!presetDependencies) continue;

      const insertedDeclaration = insertedDeclarations.find(
        (d) =>
          d.name === presetDeclaration.name &&
          d.fileId ===
            insertedFiles.find((file) => file.path === presetDeclaration.file)
              ?.id,
      );

      if (!insertedDeclaration) throw new Error("New declaration not found");

      if (
        presetDependencies.external &&
        presetDependencies.external.length > 0
      ) {
        await tx.insert(declarationPackages).values(
          presetDependencies.external.map((pkg) => {
            const insertedPkg = insertedPkgs.find((p) => p.name === pkg.name);
            console.log("insertedPkg", pkg.name);
            if (!insertedPkg) throw new Error("Package not found");
            return {
              declarationId: insertedDeclaration.id,
              packageId: insertedPkg.id,
              importPath: pkg.importPath,
              declarations: pkg.dependsOn,
            } as typeof declarationPackages.$inferInsert;
          }),
        );
      }

      console.log(
        "presetDependencies.internal for",
        insertedDeclaration.name,
        presetDependencies.internal,
      );

      const internalDependencies = presetDependencies.internal?.flatMap(
        (dependency) =>
          dependency.dependsOn.map((dep) => {
            const fileId = insertedFiles.find((file) => {
              const normalizedFilePath = file.path.replace(/\.[^/.]+$/, "");
              const normalizedImportPath = dependency.importPath?.startsWith(
                "/",
              )
                ? dependency.importPath?.replace(/\.[^/.]+$/, "")
                : `/${dependency.importPath?.replace(/\.[^/.]+$/, "")}`;

              return (
                normalizedFilePath === normalizedImportPath ||
                normalizedFilePath === `${normalizedImportPath}/index`
              );
            })?.id;
            if (!fileId) throw new Error("File ID not found");
            return { fileId, name: dep };
          }),
      );

      console.log(
        "internalDependencies for",
        insertedDeclaration.name,
        internalDependencies,
      );

      if (internalDependencies && internalDependencies.length > 0) {
        await tx.insert(dependencies).values(
          internalDependencies.map((dep) => {
            const dependency = insertedDeclarations.find(
              (d) => d.fileId === dep.fileId && d.name === dep.name,
            );
            if (!dependency) throw new Error("Dependency not found");
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

    return version;
  });
};
