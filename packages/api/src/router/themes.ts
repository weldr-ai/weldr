import { TRPCError } from "@trpc/server";
import { and, eq } from "@weldr/db";
import {
  files,
  themes,
  versionDeclarations,
  versionFiles,
  versionPackages,
  versions,
} from "@weldr/db/schema";
import { toCssVariables } from "@weldr/shared/color-utils";
import { Fly } from "@weldr/shared/fly";
import { S3 } from "@weldr/shared/s3";
import { themeSchema } from "@weldr/shared/validators/themes";
import { z } from "zod";
import { takeScreenshot } from "../take-screenshot";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const themesRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        data: themeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const [theme] = await tx
          .insert(themes)
          .values({
            projectId: input.projectId,
            userId: ctx.session.user.id,
            data: input.data,
          })
          .returning();

        if (!theme) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Theme not found",
          });
        }

        const currentVersion = await tx.query.versions.findFirst({
          where: and(
            eq(versions.projectId, input.projectId),
            eq(versions.userId, ctx.session.user.id),
            eq(versions.isCurrent, true),
          ),
          with: {
            files: true,
            declarations: true,
            packages: true,
          },
        });

        if (!currentVersion || !currentVersion.machineId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Current version not found",
          });
        }

        await tx
          .update(versions)
          .set({
            isCurrent: false,
          })
          .where(eq(versions.id, currentVersion.id));

        const [newVersion] = await tx
          .insert(versions)
          .values({
            projectId: input.projectId,
            userId: ctx.session.user.id,
            themeId: theme.id,
            isCurrent: true,
            progress: "succeeded",
            parentVersionId: currentVersion.id,
            number: currentVersion.number + 1,
            description: "Updated theme",
            message: "Updated theme",
          })
          .returning();

        if (!newVersion) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "New version not found",
          });
        }

        await tx.insert(versionDeclarations).values(
          currentVersion.declarations.map((e) => ({
            versionId: newVersion.id,
            declarationId: e.declarationId,
          })),
        );

        await tx.insert(versionFiles).values(
          currentVersion.files.map((e) => ({
            versionId: newVersion.id,
            fileId: e.fileId,
            s3VersionId: e.s3VersionId,
          })),
        );

        await tx.insert(versionPackages).values(
          currentVersion.packages.map((e) => ({
            versionId: newVersion.id,
            packageId: e.packageId,
          })),
        );

        const globalsCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    ${toCssVariables(input.data.light)}
  }

  .dark {
    ${toCssVariables(input.data.dark)}
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`;

        // Write the new version to S3
        const newVersionS3 = await S3.writeFile({
          projectId: input.projectId,
          path: "/src/styles/globals.css",
          content: globalsCss,
        });

        if (!newVersionS3) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "New version S3 not found",
          });
        }

        const file = await tx.query.files.findFirst({
          where: and(
            eq(files.projectId, input.projectId),
            eq(files.path, "/src/styles/globals.css"),
          ),
        });

        if (!file) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File not found",
          });
        }

        await tx
          .insert(versionFiles)
          .values({
            versionId: newVersion.id,
            fileId: file.id,
            s3VersionId: newVersionS3,
          })
          .onConflictDoUpdate({
            target: [versionFiles.versionId, versionFiles.fileId],
            set: {
              s3VersionId: newVersionS3,
            },
          });

        // Update the current machine
        const machine = await Fly.machine.get({
          projectId: input.projectId,
          machineId: currentVersion.machineId,
        });

        if (!machine) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Machine not found",
          });
        }

        const machineFiles = [
          ...(machine.config?.files ?? [])
            .filter((f) => f.guest_path !== "/app/src/styles/globals.css")
            .map((f) => ({
              guest_path: f.guest_path as string,
              raw_value: f.raw_value as string,
            })),
          {
            guest_path: "/app/src/styles/globals.css",
            raw_value: Buffer.from(globalsCss).toString("base64"),
          },
        ];

        const newMachineId = await Fly.machine.create({
          projectId: input.projectId,
          versionId: newVersion.id,
          config: {
            image: "registry.fly.io/boilerplates:next",
            files: machineFiles,
          },
        });

        if (!newMachineId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "New machine not found",
          });
        }

        await takeScreenshot({
          tx,
          versionId: newVersion.id,
          projectId: input.projectId,
        });

        await tx
          .update(versions)
          .set({
            machineId: newMachineId,
          })
          .where(eq(versions.id, newVersion.id));

        return newVersion;
      });
    }),
});
