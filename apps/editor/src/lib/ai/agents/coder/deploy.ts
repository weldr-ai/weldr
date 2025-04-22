import { and, db, eq } from "@weldr/db";
import {
  files,
  versionFiles,
  versionPackages,
  versions,
} from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
import { S3 } from "@weldr/shared/s3";
import { getBasePackageJson } from "./utils";

export async function deploy({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  return db.transaction(async (tx) => {
    let machineId: string | undefined;

    try {
      const version = await tx.query.versions.findFirst({
        where: eq(versions.id, versionId),
        with: {
          project: {
            columns: {
              name: true,
            },
          },
        },
      });

      if (!version) {
        throw new Error("Version not found");
      }

      const previousVersion = await tx.query.versions.findFirst({
        where: and(
          eq(versions.projectId, version.projectId),
          eq(versions.number, version.number - 1),
        ),
      });

      let currentMachine:
        | Awaited<ReturnType<typeof Fly.machine.get>>
        | undefined;

      if (previousVersion?.machineId) {
        currentMachine = await Fly.machine.get({
          projectId,
          machineId: previousVersion.machineId,
        });
      }

      const versionPackagesResult = await tx.query.versionPackages.findMany({
        where: eq(versionPackages.versionId, version.id),
        with: {
          package: {
            columns: {
              name: true,
              type: true,
              version: true,
            },
          },
        },
      });

      const dependencies = versionPackagesResult.filter(
        (p) => p.package.type === "runtime",
      );

      const devDependencies = versionPackagesResult.filter(
        (p) => p.package.type === "development",
      );

      const packageJson = JSON.stringify({
        ...getBasePackageJson(version.project.name ?? "weldr-app"),
        dependencies: dependencies.reduce(
          (acc, p) => {
            acc[p.package.name] = p.package.version;
            return acc;
          },
          {} as Record<string, string>,
        ),
        devDependencies: devDependencies.reduce(
          (acc, p) => {
            acc[p.package.name] = p.package.version;
            return acc;
          },
          {} as Record<string, string>,
        ),
      });

      const changedFiles = await Promise.all(
        version.changedFiles.map(async (f) => {
          const content = await S3.readFile({
            projectId,
            path: f,
          });

          if (!content) {
            throw new Error(`File ${f} not found`);
          }

          return {
            guest_path: `/app/${f}`,
            raw_value: Buffer.from(content).toString("base64"),
          };
        }),
      );

      const filteredMachineFiles =
        currentMachine?.config?.files?.reduce(
          (acc, machineFile) => {
            if (
              machineFile.guest_path &&
              machineFile.raw_value &&
              !changedFiles.some(
                (f) => f.guest_path === machineFile.guest_path,
              ) &&
              machineFile.guest_path !== "/app/package.json"
            ) {
              acc.push({
                guest_path: machineFile.guest_path,
                raw_value: machineFile.raw_value,
              });
            }
            return acc;
          },
          [] as { guest_path: string; raw_value: string }[],
        ) ?? [];

      const newMachineFiles = [
        ...changedFiles,
        ...filteredMachineFiles,
        {
          guest_path: "/app/package.json",
          raw_value: Buffer.from(packageJson).toString("base64"),
        },
      ];

      console.log(
        `[coder:${projectId}] Files`,
        newMachineFiles.map((f) => f.guest_path),
      );

      // Create a new machine
      machineId = await Fly.machine.create({
        projectId,
        versionId,
        config: {
          image: "registry.fly.io/boilerplates:next",
          files: newMachineFiles,
        },
      });

      await Fly.machine.executeCommand({
        projectId,
        machineId,
        command: "cd app && bun i",
      });

      // Write bun.lockb and package.json to S3
      const bunDotLock = await Fly.machine.executeCommand({
        projectId,
        machineId,
        command: "cat /app/bun.lock",
      });

      if (bunDotLock.stdout) {
        const bunDotLockVersionId = await S3.writeFile({
          projectId,
          path: "/bun.lock",
          content: bunDotLock.stdout,
        });

        const bunDotLockFile = await tx.query.files.findFirst({
          where: and(
            eq(files.path, "/bun.lock"),
            eq(files.projectId, projectId),
          ),
        });

        if (!bunDotLockFile || !bunDotLockVersionId) {
          throw new Error("Bun.lock file not found");
        }

        await tx.insert(versionFiles).values({
          versionId: version.id,
          fileId: bunDotLockFile.id,
          s3VersionId: bunDotLockVersionId,
        });
      }

      const packageJsonVersionId = await S3.writeFile({
        projectId,
        path: "/package.json",
        content: packageJson,
      });

      const packageJsonFile = await tx.query.files.findFirst({
        where: and(
          eq(files.path, "/package.json"),
          eq(files.projectId, projectId),
        ),
      });

      if (!packageJsonFile || !packageJsonVersionId) {
        throw new Error("Package.json file not found");
      }

      // Write package.json to S3
      await tx.insert(versionFiles).values({
        versionId: version.id,
        fileId: packageJsonFile.id,
        s3VersionId: packageJsonVersionId,
      });

      await tx
        .update(versions)
        .set({
          machineId,
          progress: "deployed",
        })
        .where(eq(versions.id, versionId));

      return machineId;
    } catch (error) {
      if (machineId) {
        await Fly.machine.destroy({ projectId, machineId });
      }
      throw error;
    }
  });
}
