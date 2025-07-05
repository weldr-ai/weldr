import { and, db, eq, isNotNull } from "@weldr/db";
import { chats, versionDeclarations, versions } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";

export const initVersion = async ({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}): Promise<typeof versions.$inferSelect> => {
  const logger = Logger.get({
    projectId,
  });

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
        declarations: true,
      },
    });

    if (activeVersion) {
      logger.info("Getting latest version number...");
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

      logger.info("Updating previous versions...");
      await tx
        .update(versions)
        .set({
          activatedAt: null,
        })
        .where(
          and(eq(versions.projectId, projectId), eq(versions.userId, userId)),
        );

      logger.info("Creating version chat...");
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

      logger.info("Creating new version...");
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

      logger.info(
        `Copying ${activeVersion.declarations.length} declarations...`,
      );
      await tx.insert(versionDeclarations).values(
        activeVersion.declarations.map((declaration) => ({
          versionId: version.id,
          declarationId: declaration.declarationId,
        })),
      );

      return version;
    }

    logger.info("Creating version chat...");
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

    logger.info("Creating version");
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

    // TODO: REQUIRES RE-IMPLEMENTATION

    // logger.info({ message: "Getting preset" });
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

    // logger.info({ message: "Inserting declarations" });
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

    // logger.info({
    //   message: "Inserting declaration packages and dependencies",
    // });
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
    //         logger.info({ message: `insertedPkg: ${pkg.name}` });
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

    //   logger.info({
    //     message: `presetDependencies.internal for ${insertedDeclaration.name}`,
    //     presetDependencies: presetDependencies.internal,
    //   });

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

    //   logger.info({
    //     message: `internalDependencies for ${insertedDeclaration.name}`,
    //     internalDependencies,
    //   });

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
