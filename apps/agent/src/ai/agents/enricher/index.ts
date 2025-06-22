import { prompts } from "@/ai/prompts";
import { runCommand } from "@/ai/utils/commands";
import { registry } from "@/ai/utils/registry";
import { WORKSPACE_DIR } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import type { WorkflowContext } from "@/workflow/context";
import { and, db, eq, inArray } from "@weldr/db";
import {
  canvasNodes,
  declarationPackages,
  declarations,
  dependencies,
  packages,
  versionDeclarations,
  versionFiles,
  versions,
} from "@weldr/db/schema";
import { nanoid } from "@weldr/shared/nanoid";
import { streamObject } from "ai";
import type { z } from "zod";
import {
  type declarationSpecsWithDependenciesSchema,
  enricherAgentOutputSchema,
} from "./schemas";

export async function enrichAgent({
  context,
  coolDownPeriod = 1000,
}: {
  context: WorkflowContext;
  coolDownPeriod?: number;
}) {
  const project = context.get("project");
  const contextVersion = context.get("version");
  const user = context.get("user");

  // Create contextual logger with base tags and extras
  const logger = Logger.get({
    tags: ["enricherAgent"],
    extra: {
      projectId: project.id,
      versionId: contextVersion.id,
    },
  });

  await db.transaction(async (tx) => {
    const version = await tx.query.versions.findFirst({
      where: eq(versions.id, contextVersion.id),
      with: {
        declarations: {
          with: {
            declaration: {
              with: {
                file: true,
              },
            },
          },
        },
      },
    });

    if (!version) {
      throw new Error("Version not found");
    }

    const versionFilesList = await tx.query.versionFiles.findMany({
      where: eq(versionFiles.versionId, contextVersion.id),
      with: {
        file: true,
      },
    });

    const allFiles = versionFilesList.map((file) => file.file);
    const changedFiles = allFiles.filter((file) => {
      const normalizedPaths = version.changedFiles
        .filter((path) => path.endsWith(".tsx") || path.endsWith(".ts"))
        .map((path) => (path.startsWith("/") ? path : `/${path}`));
      return normalizedPaths.some((path) => file.path === path);
    });

    logger.info(`Found ${changedFiles.map((file) => file.path)} changed files`);

    const insertDeclarations: (typeof declarations.$inferSelect)[] = [];
    const allEnrichedDeclarations: z.infer<
      typeof declarationSpecsWithDependenciesSchema
    >[] = [];

    for (const file of changedFiles) {
      logger.info(`Processing file ${file.path}`);

      const { stdout, stderr, exitCode, success } = await runCommand("cat", [
        `${WORKSPACE_DIR}/${file.path}`,
      ]);

      if (exitCode !== 0 || !stdout || !success) {
        logger.error(
          `Failed to read file: ${file.path} ${stderr || "Unknown error"}`,
        );
        throw new Error(
          `[enrich:${project.id}] Failed to read file: ${file.path} ${stderr || ""}`,
        );
      }

      logger.info(`Processing file ${file.path}`);

      // TODO: Figure out how to add previous content
      // ${
      //   previousContent
      //     ? `${file.path}
      // \`\`\`
      // ${previousContent}
      // \`\`\`
      // `
      //     : "There is no previous file"
      // }

      const result = await streamObject({
        system: prompts.enricher,
        messages: [
          {
            role: "user",
            content: `# Code

              Current file:
              ${file.path}
            \`\`\`
            ${stdout}
            \`\`\``,
          },
        ],
        model: registry.languageModel("openai:gpt-4.1"),
        schema: enricherAgentOutputSchema,
      });

      for await (const _ of result.partialObjectStream) {
      }

      const {
        declarations: enrichedDeclarations,
        metadata: { deletedDeclarations, updatedDeclarations },
      } = await result.object;

      allEnrichedDeclarations.push(...enrichedDeclarations);

      // Delete all declarations that are deleted or updated from the current version
      const deletedAndUpdatedDeclarations = [
        ...deletedDeclarations,
        ...updatedDeclarations,
      ];

      if (deletedAndUpdatedDeclarations.length > 0) {
        const versionDeletedAndUpdatedDeclarations =
          version.declarations.filter(
            (declaration) =>
              declaration.declaration.file.path === file.path &&
              deletedAndUpdatedDeclarations.includes(
                declaration.declaration.name,
              ),
          );

        // Delete the version declarations
        if (versionDeletedAndUpdatedDeclarations.length > 0) {
          await tx.delete(versionDeclarations).where(
            and(
              eq(versionDeclarations.versionId, contextVersion.id),
              inArray(
                versionDeclarations.declarationId,
                versionDeletedAndUpdatedDeclarations.map(
                  (declaration) => declaration.declaration.id,
                ),
              ),
            ),
          );
        }
      }

      logger.info(`Found ${enrichedDeclarations.length} enriched declarations`);

      // Insert the new enriched declarations
      for (const enrichedDeclaration of enrichedDeclarations) {
        const declarationId = nanoid();

        const declarationName = getDeclarationName(enrichedDeclaration);

        const declarationCreatedAt = new Date();
        const declarationUpdatedAt = new Date();

        const previousDeclaration = version.declarations.find(
          (declaration) =>
            declaration.declaration.name === declarationName &&
            declaration.declaration.fileId === file.id,
        )?.declaration;

        let canvasNode: typeof canvasNodes.$inferSelect | undefined =
          previousDeclaration?.canvasNodeId
            ? await tx.query.canvasNodes.findFirst({
                where: eq(canvasNodes.id, previousDeclaration.canvasNodeId),
              })
            : undefined;

        if (enrichedDeclaration.isNode) {
          // Insert the canvas node if it doesn't exist
          if (!canvasNode) {
            const [insertedCanvasNode] = await tx
              .insert(canvasNodes)
              .values({
                type: "declaration",
                position: {
                  x: 0,
                  y: 0,
                },
                projectId: project.id,
              })
              .returning();

            if (!insertedCanvasNode) {
              throw new Error("Failed to insert canvas node");
            }

            canvasNode = insertedCanvasNode;
          }
        }

        insertDeclarations.push({
          id: declarationId,
          fileId: file.id,
          name: declarationName,
          type: enrichedDeclaration.type,
          specs: {
            version: "v1",
            data: enrichedDeclaration,
          },
          projectId: project.id,
          userId: user.id,
          previousId: previousDeclaration?.id ?? null,
          canvasNodeId: canvasNode?.id ?? null,
          createdAt: declarationCreatedAt,
          updatedAt: declarationUpdatedAt,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, coolDownPeriod));
    }

    if (insertDeclarations.length > 0) {
      await tx.insert(declarations).values(insertDeclarations);

      await tx.insert(versionDeclarations).values(
        insertDeclarations.map((declaration) => ({
          versionId: contextVersion.id,
          declarationId: declaration.id,
        })),
      );

      // Insert declaration dependencies
      for (const declaration of insertDeclarations) {
        const enrichedDeclaration = allEnrichedDeclarations.find(
          (enrichedDeclaration) => {
            const declarationName = getDeclarationName(enrichedDeclaration);
            return declarationName === declaration.name;
          },
        );

        if (!enrichedDeclaration) {
          throw new Error(`Declaration not found: ${declaration.name}`);
        }

        // Get the stored packages
        const storedPkgs = await tx.query.packages.findMany({
          where: and(
            inArray(
              packages.name,
              enrichedDeclaration.dependencies.external.map((pkg) => pkg.name),
            ),
            eq(packages.projectId, project.id),
          ),
        });

        if (enrichedDeclaration.dependencies.external.length > 0) {
          await tx.insert(declarationPackages).values(
            enrichedDeclaration.dependencies.external.map((pkg) => {
              const pkgId = storedPkgs.find(
                (storedPkg) => storedPkg.name === pkg.name,
              )?.id;

              if (!pkgId) {
                throw new Error(`Package not found: ${pkg.name}`);
              }

              return {
                declarationId: declaration.id,
                packageId: pkgId,
                importPath: pkg.name,
                declarations: pkg.dependsOn,
              };
            }),
          );
        }

        // Get all declarations after inserting the new declarations
        const versionNewDeclarations =
          await tx.query.versionDeclarations.findMany({
            where: eq(versionDeclarations.versionId, contextVersion.id),
            with: {
              declaration: {
                with: {
                  file: true,
                },
              },
            },
          });

        for (const dependency of enrichedDeclaration.dependencies.internal) {
          // Get the dependencies that match the dependency name and file path
          const tempDependencies = versionNewDeclarations.filter(
            (declaration) => {
              if (!dependency.importPath) {
                // TODO: Check if this is correct and actually works
                // Handle RPC and REST API cases
                if (
                  declaration.declaration.type === "endpoint" &&
                  declaration.declaration.specs
                ) {
                  const endpointSpecs = declaration.declaration.specs.data as {
                    definition: {
                      name?: string;
                      method?: string;
                      path?: string;
                    };
                  };
                  // For REST, match by HTTP method and path
                  const restName = `${endpointSpecs.definition.method?.toUpperCase()}:${endpointSpecs.definition.path}`;
                  return dependency.dependsOn.includes(restName);
                }
                return false;
              }

              const declarationNormalizedFilePath =
                declaration.declaration.file.path.startsWith("/")
                  ? declaration.declaration.file.path.replace(/\.[^/.]+$/, "")
                  : `/${declaration.declaration.file.path.replace(/\.[^/.]+$/, "")}`;

              const dependencyNormalizedFilePath =
                dependency.importPath.startsWith("/")
                  ? dependency.importPath.replace(/\.[^/.]+$/, "")
                  : `/${dependency.importPath.replace(/\.[^/.]+$/, "")}`;

              return (
                dependency.dependsOn.includes(declaration.declaration.name) &&
                (declarationNormalizedFilePath ===
                  dependencyNormalizedFilePath ||
                  declarationNormalizedFilePath ===
                    `${dependencyNormalizedFilePath}/index`)
              );
            },
          );

          if (tempDependencies.length > 0) {
            await tx.insert(dependencies).values(
              tempDependencies.map((dependency) => ({
                dependentType: declaration.type,
                dependentId: declaration.id,
                dependencyType: dependency.declaration.type,
                dependencyId: dependency.declaration.id,
              })),
            );
          }
        }
      }
    }

    await tx
      .update(versions)
      .set({
        progress: "enriched",
      })
      .where(eq(versions.id, contextVersion.id));
  });
}

const getDeclarationName = (
  enrichedDeclaration: z.infer<typeof declarationSpecsWithDependenciesSchema>,
) => {
  switch (enrichedDeclaration.type) {
    case "component": {
      return enrichedDeclaration.definition.name;
    }
    case "function":
    case "model":
    case "other": {
      return enrichedDeclaration.name;
    }
    case "endpoint": {
      return `${enrichedDeclaration.definition.method.toUpperCase()}:${enrichedDeclaration.definition.path}`;
    }
  }
};
