import { and, db, eq } from "@weldr/db";
import {
  branches,
  chats,
  versionDeclarations,
  versions,
} from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";

export const initVersion = async ({
  projectId,
  branchId,
  userId,
}: {
  projectId: string;
  branchId: string;
  userId: string;
}): Promise<typeof versions.$inferSelect> => {
  const logger = Logger.get({
    projectId,
  });

  return db.transaction(async (tx) => {
    const branch = await tx.query.branches.findFirst({
      where: and(eq(branches.projectId, projectId), eq(branches.id, branchId)),
      with: {
        headVersion: {
          with: {
            declarations: true,
          },
        },
      },
    });

    if (!branch || !branch.headVersion) {
      throw new Error("Branch not found");
    }

    const activeVersion = branch.headVersion;

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
          branchId,
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
        branchId,
      })
      .returning();

    if (!version) {
      throw new Error("Version not found");
    }
    return version;
  });
};
