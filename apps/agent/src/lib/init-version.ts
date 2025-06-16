import { and, db, eq, isNotNull } from "@weldr/db";
import {
  chats,
  versionDeclarations,
  versionFiles,
  versionPackages,
  versions,
} from "@weldr/db/schema";

export const initVersion = async ({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}): Promise<typeof versions.$inferSelect> => {
  return db.transaction(async (tx) => {
    const activeVersion = await tx.query.versions.findFirst({
      where: and(
        eq(versions.projectId, projectId),
        eq(versions.userId, userId),
        isNotNull(versions.activatedAt),
      ),
      columns: {
        id: true,
        number: true,
        message: true,
        description: true,
        chatId: true,
      },
      with: {
        files: true,
        packages: true,
        declarations: true,
      },
    });

    if (activeVersion) {
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
          activatedAt: null,
        })
        .where(
          and(eq(versions.projectId, projectId), eq(versions.userId, userId)),
        );

      console.log(`[coderTool:${projectId}] Creating version chat...`);
      const [versionChat] = await tx
        .insert(chats)
        .values({
          projectId,
          userId,
        })
        .returning();

      if (!versionChat) {
        throw new Error("Version chat not found");
      }

      console.log(`[coderTool:${projectId}] Creating new version...`);
      const [version] = await tx
        .insert(versions)
        .values({
          projectId,
          userId,
          number: latestNumber.number + 1,
          parentVersionId: activeVersion.id,
          chatId: versionChat.id,
        })
        .returning();

      if (!version) {
        throw new Error("Version not found");
      }

      console.log(
        `[coderTool:${projectId}] Copying ${activeVersion.files.length} files...`,
      );
      await tx.insert(versionFiles).values(
        activeVersion.files.map((file) => ({
          versionId: version.id,
          fileId: file.fileId,
        })),
      );

      console.log(
        `[coderTool:${projectId}] Copying ${activeVersion.packages.length} packages...`,
      );
      await tx.insert(versionPackages).values(
        activeVersion.packages.map((pkg) => ({
          versionId: version.id,
          packageId: pkg.packageId,
        })),
      );

      console.log(
        `[coderTool:${projectId}] Copying ${activeVersion.declarations.length} declarations...`,
      );
      await tx.insert(versionDeclarations).values(
        activeVersion.declarations.map((declaration) => ({
          versionId: version.id,
          declarationId: declaration.declarationId,
        })),
      );

      return version;
    }

    // console.log(`[coderTool:${projectId}] Getting preset`);
    // const preset = await tx.query.presets.findFirst({
    //   where: eq(presets.type, "base"),
    //   with: {
    //     declarations: true,
    //     files: true,
    //     packages: true,
    //   },
    // });

    // if (!preset) {
    //   throw new Error("Preset not found");
    // }

    // const presetThemes = await tx.query.presetThemes.findMany();

    // const randomNumber = Math.floor(Math.random() * presetThemes.length);

    // const presetTheme = presetThemes[randomNumber];

    // if (!presetTheme) {
    //   throw new Error("Theme not found");
    // }

    // const [projectTheme] = await tx
    //   .insert(themes)
    //   .values({
    //     data: presetTheme.data,
    //     userId,
    //     projectId,
    //   })
    //   .returning();

    // if (!projectTheme) {
    //   throw new Error("Project theme not found");
    // }

    console.log(`[coderTool:${projectId}] Creating version chat...`);
    const [versionChat] = await tx
      .insert(chats)
      .values({
        projectId,
        userId,
      })
      .returning();

    if (!versionChat) {
      throw new Error("Version chat not found");
    }

    console.log(`[coderTool:${projectId}] Creating version`);
    const [version] = await tx
      .insert(versions)
      .values({
        projectId,
        userId,
        number: 1,
        message: null,
        description: null,
        chatId: versionChat.id,
      })
      .returning();

    if (!version) {
      throw new Error("Version not found");
    }

    // console.log(`[coderTool:${projectId}] Inserting files`);
    // const insertedFiles = await tx
    //   .insert(files)
    //   .values(
    //     preset.files.map((file) => ({
    //       userId,
    //       projectId,
    //       path: file.path,
    //     })),
    //   )
    //   .onConflictDoNothing()
    //   .returning();

    // console.log(`[coderTool:${projectId}] Inserting version files`);
    // await tx.insert(versionFiles).values(
    //   insertedFiles.map((file) => {
    //     console.log(
    //       `${projectId}${file.path.startsWith("/") ? file.path : `/${file.path}`}`,
    //     );

    //     return {
    //       versionId: version.id,
    //       fileId: file.id,
    //     };
    //   }),
    // );

    // console.log(`[coderTool:${projectId}] Inserting packages`);
    // const insertedPkgs = await tx
    //   .insert(packages)
    //   .values(
    //     preset.packages.map((pkg) => ({
    //       name: pkg.name,
    //       type: pkg.type,
    //       version: pkg.version,
    //       projectId,
    //     })),
    //   )
    //   .returning();

    // await tx.insert(versionPackages).values(
    //   insertedPkgs.map((pkg) => ({
    //     versionId: version.id,
    //     packageId: pkg.id,
    //   })),
    // );

    // console.log(`[coderTool:${projectId}] Inserting declarations`);
    // const insertedDeclarations = await tx
    //   .insert(declarations)
    //   .values(
    //     preset.declarations.map((declaration) => {
    //       const fileId = insertedFiles.find(
    //         (file) => file.path === declaration.file,
    //       )?.id;
    //       if (!fileId) {
    //         throw new Error(
    //           `File ID not found for declaration ${declaration.name}`,
    //         );
    //       }
    //       return {
    //         name: declaration.name,
    //         type: declaration.type,
    //         specs: declaration.specs,
    //         userId,
    //         projectId,
    //         fileId,
    //       } as typeof declarations.$inferInsert;
    //     }),
    //   )
    //   .returning();

    // await tx.insert(versionDeclarations).values(
    //   insertedDeclarations.map((declaration) => ({
    //     versionId: version.id,
    //     declarationId: declaration.id,
    //   })),
    // );

    // console.log(
    //   `[coderTool:${projectId}] Inserting declaration packages and dependencies`,
    // );
    // for (const presetDeclaration of preset.declarations) {
    //   const presetDependencies = presetDeclaration.dependencies;
    //   if (!presetDependencies) continue;

    //   const insertedDeclaration = insertedDeclarations.find(
    //     (d) =>
    //       d.name === presetDeclaration.name &&
    //       d.fileId ===
    //         insertedFiles.find((file) => file.path === presetDeclaration.file)
    //           ?.id,
    //   );

    //   if (!insertedDeclaration) throw new Error("New declaration not found");

    //   if (
    //     presetDependencies.external &&
    //     presetDependencies.external.length > 0
    //   ) {
    //     await tx.insert(declarationPackages).values(
    //       presetDependencies.external.map((pkg) => {
    //         const insertedPkg = insertedPkgs.find((p) => p.name === pkg.name);
    //         console.log("insertedPkg", pkg.name);
    //         if (!insertedPkg) throw new Error("Package not found");
    //         return {
    //           declarationId: insertedDeclaration.id,
    //           packageId: insertedPkg.id,
    //           importPath: pkg.importPath,
    //           declarations: pkg.dependsOn,
    //         } as typeof declarationPackages.$inferInsert;
    //       }),
    //     );
    //   }

    //   console.log(
    //     "presetDependencies.internal for",
    //     insertedDeclaration.name,
    //     presetDependencies.internal,
    //   );

    //   const internalDependencies = presetDependencies.internal?.flatMap(
    //     (dependency) =>
    //       dependency.dependsOn.map((dep) => {
    //         const fileId = insertedFiles.find((file) => {
    //           const normalizedFilePath = file.path.replace(/\.[^/.]+$/, "");
    //           const normalizedImportPath = dependency.importPath?.startsWith(
    //             "/",
    //           )
    //             ? dependency.importPath?.replace(/\.[^/.]+$/, "")
    //             : `/${dependency.importPath?.replace(/\.[^/.]+$/, "")}`;

    //           return (
    //             normalizedFilePath === normalizedImportPath ||
    //             normalizedFilePath === `${normalizedImportPath}/index`
    //           );
    //         })?.id;
    //         if (!fileId) throw new Error("File ID not found");
    //         return { fileId, name: dep };
    //       }),
    //   );

    //   console.log(
    //     "internalDependencies for",
    //     insertedDeclaration.name,
    //     internalDependencies,
    //   );

    //   if (internalDependencies && internalDependencies.length > 0) {
    //     await tx.insert(dependencies).values(
    //       internalDependencies.map((dep) => {
    //         const dependency = insertedDeclarations.find(
    //           (d) => d.fileId === dep.fileId && d.name === dep.name,
    //         );
    //         if (!dependency) throw new Error("Dependency not found");
    //         return {
    //           dependentId: insertedDeclaration.id,
    //           dependentType: insertedDeclaration.type,
    //           dependencyId: dependency.id,
    //           dependencyType: dependency.type,
    //         };
    //       }),
    //     );
    //   }
    // }

    return version;
  });
};
