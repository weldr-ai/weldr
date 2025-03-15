"use server";

import { models } from "@/lib/ai/models";
import { api } from "@/lib/trpc/server";
import { auth } from "@weldr/auth";
import { type InferInsertModel, and, db, eq } from "@weldr/db";
import {
  chats,
  declarationPackages,
  declarations,
  dependencies,
  files,
  packages,
  presets,
  projects,
  versionFiles,
  versions,
} from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";
import { S3 } from "@weldr/shared/s3";
import type { ToolMessageRawContent } from "@weldr/shared/types";
import type { addMessageItemSchema } from "@weldr/shared/validators/chats";
import { type CoreMessage, streamText } from "ai";
import { createStreamableValue } from "ai/rsc";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { prompts } from "../prompts";
import {
  implementTool,
  initializeProjectTool,
  setupResourceTool,
} from "../tools";
import { coder } from "./coder";

export async function requirementsGatherer({
  chatId,
  projectId,
}: {
  chatId: string;
  projectId: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, session.user.id),
    ),
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, chatId),
    with: {
      messages: {
        orderBy: (chatMessages, { asc }) => [asc(chatMessages.createdAt)],
        columns: {
          role: true,
          content: true,
          rawContent: true,
        },
        limit: 10,
      },
    },
  });

  if (!chat) {
    throw new Error("Chat not found");
  }

  const promptMessages: CoreMessage[] = [];

  for (const message of chat.messages) {
    if (message.role === "tool") {
      const toolInfo = message.rawContent as ToolMessageRawContent;

      if (
        toolInfo.toolName === "setupResource" &&
        toolInfo.toolResult?.status !== "pending"
      ) {
        promptMessages.push({
          role: "user",
          content: `Setting up ${toolInfo.toolArgs?.resource} has been ${toolInfo.toolResult?.status}.`,
        });
      }

      continue;
    }

    if (message.content === null || message.role === "version") continue;

    promptMessages.push({
      role: message.role,
      content: message.content,
    });
  }

  const stream = createStreamableValue<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "tool";
        toolName: string;
        toolArgs: Record<string, unknown>;
        toolResult: unknown;
      }
  >();

  (async () => {
    const { textStream } = streamText({
      model: models.geminiFlash,
      system: prompts.requirementsGatherer,
      messages: promptMessages,
      experimental_activeTools: project.initiatedAt
        ? ["implementTool", "setupResourceTool"]
        : ["initializeProjectTool", "setupResourceTool"],
      tools: {
        implementTool,
        initializeProjectTool,
        setupResourceTool,
      },
      maxSteps: 3,
      onFinish: async ({ text, finishReason, toolCalls, toolResults }) => {
        try {
          const messages: z.infer<typeof addMessageItemSchema>[] = [];

          if (finishReason === "tool-calls") {
            for (const toolCall of toolCalls) {
              const toolResult = toolResults.find(
                (toolResult) => toolResult.toolCallId === toolCall.toolCallId,
              );

              // Process each tool call sequentially
              await (async () => {
                switch (toolCall.toolName) {
                  case "initializeProjectTool": {
                    stream.update({
                      type: "tool",
                      toolName: toolCall.toolName,
                      toolArgs: toolCall.args,
                      toolResult: {
                        status: "pending",
                      },
                    });

                    await db.transaction(async (tx) => {
                      // Get the preset
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
                      await tx
                        .update(projects)
                        .set({
                          name: toolCall.args.name,
                          // initiatedAt: new Date(),
                        })
                        .where(eq(projects.id, projectId));

                      // Create a new version
                      const [version] = await tx
                        .insert(versions)
                        .values({
                          projectId,
                          userId: session.user.id,
                          number: 1,
                          isCurrent: true,
                          message: toolCall.args.commitMessage,
                        })
                        .returning();

                      if (!version) {
                        throw new Error("Version not found");
                      }

                      // Copy boilerplate files to the project
                      const fileVersions = await S3.copyBoilerplate({
                        boilerplate: "next-base",
                        destinationPath: `${projectId}`,
                      });

                      // Insert files from preset to the project
                      const insertedFiles = await tx
                        .insert(files)
                        .values(
                          preset.files.map((file) => ({
                            userId: session.user.id,
                            projectId,
                            path: file.path,
                          })),
                        )
                        .returning();

                      // Insert version files
                      await tx.insert(versionFiles).values(
                        insertedFiles.map((file) => {
                          const s3VersionId = fileVersions[file.path];

                          if (!s3VersionId) {
                            throw new Error(
                              `S3 version ID not found for file ${file.path}`,
                            );
                          }

                          return {
                            versionId: version.id,
                            fileId: file.id,
                            s3VersionId,
                          };
                        }),
                      );

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
                              userId: session.user.id,
                              projectId,
                              fileId,
                            } as InferInsertModel<typeof declarations>;
                          }),
                        )
                        .returning();

                      // Insert declaration packages and dependencies
                      for (const presetDeclaration of preset.declarations) {
                        const presetDependencies =
                          presetDeclaration.dependencies;

                        if (!presetDependencies) {
                          continue;
                        }

                        // Find the corresponding newly created declaration
                        const insertedDeclaration = insertedDeclarations.find(
                          (d) =>
                            d.name === presetDeclaration.name &&
                            d.fileId ===
                              insertedFiles.find(
                                (file) => file.path === presetDeclaration.file,
                              )?.id,
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
                              const insertedPkg = insertedPkgs.find(
                                (p) => p.name === pkg.from,
                              );

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
                          ?.filter(
                            (dependency) => dependency.type === "internal",
                          )
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
                                (d) =>
                                  d.fileId === dep.fileId &&
                                  d.name === dep.name,
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

                      const machineId = await Fly.machine.create({
                        projectId,
                        versionId: version.id,
                      });

                      await tx
                        .update(versions)
                        .set({
                          machineId,
                        })
                        .where(eq(versions.id, version.id));

                      await coder({
                        tx,
                        projectId,
                        versionId: version.id,
                        machineId,
                        userId: session.user.id,
                        prompt: {
                          role: "user",
                          content: [
                            {
                              type: "text",
                              text: `Please, create this new app: ${toolCall.args.requirements}
                            You MUST NOT create any database schemas or authentication. THIS IS A PURE CLIENT APP.`,
                            },
                            ...(toolCall.args.attachments ?? []).map(
                              (attachment) => ({
                                type: "image" as const,
                                image: attachment,
                              }),
                            ),
                          ],
                        },
                      });
                    });

                    stream.update({
                      type: "tool",
                      toolName: toolCall.toolName,
                      toolArgs: toolCall.args,
                      toolResult: {
                        status: "success",
                      },
                    });
                    break;
                  }
                  case "implementTool": {
                    stream.update({
                      type: "tool",
                      toolName: toolCall.toolName,
                      toolArgs: toolCall.args,
                      toolResult: {
                        status: "pending",
                      },
                    });

                    await db.transaction(async (tx) => {
                      const previousVersion = await tx.query.versions.findFirst(
                        {
                          where: and(
                            eq(versions.projectId, projectId),
                            eq(versions.userId, session.user.id),
                            eq(versions.isCurrent, true),
                          ),
                          columns: {
                            id: true,
                            number: true,
                          },
                        },
                      );

                      if (!previousVersion) {
                        throw new Error("Version not found");
                      }

                      await tx
                        .update(versions)
                        .set({
                          isCurrent: false,
                        })
                        .where(eq(versions.projectId, projectId));

                      const [version] = await tx
                        .insert(versions)
                        .values({
                          projectId,
                          userId: session.user.id,
                          number: previousVersion.number + 1,
                          isCurrent: true,
                          message: toolCall.args.commitMessage,
                        })
                        .returning();

                      if (!version) {
                        throw new Error("Version not found");
                      }

                      const machineId = await Fly.machine.create({
                        projectId,
                        versionId: version.id,
                      });

                      await tx
                        .update(versions)
                        .set({
                          machineId,
                        })
                        .where(eq(versions.id, version.id));

                      await coder({
                        tx,
                        userId: session.user.id,
                        projectId,
                        versionId: version.id,
                        previousVersionId: previousVersion.id,
                        machineId,
                        prompt: {
                          role: "user",
                          content: [
                            {
                              type: "text",
                              text: `Please, do the following changes: ${toolCall.args.requirements}`,
                            },
                            ...(toolCall.args.attachments ?? []).map(
                              (attachment) => ({
                                type: "image" as const,
                                image: attachment,
                              }),
                            ),
                          ],
                        },
                      });
                    });

                    stream.update({
                      type: "tool",
                      toolName: toolCall.toolName,
                      toolArgs: toolCall.args,
                      toolResult: {
                        status: "success",
                      },
                    });
                    break;
                  }
                  case "setupResourceTool": {
                    stream.update({
                      type: "tool",
                      toolName: toolCall.toolName,
                      toolArgs: toolCall.args,
                      toolResult: toolResult?.result,
                    });
                    break;
                  }
                }

                if (text) {
                  messages.push({
                    role: "assistant",
                    rawContent: [{ type: "paragraph", value: text }],
                  });
                }

                messages.push({
                  role: "tool",
                  rawContent: {
                    toolName: toolCall.toolName,
                    toolArgs: toolCall.args,
                    toolResult: toolResult?.result,
                  },
                });
              })();
            }
          }

          if (finishReason === "stop" && text) {
            messages.push({
              role: "assistant",
              rawContent: [{ type: "paragraph", value: text }],
            });
          }

          if (messages.length > 0) {
            await api.chats.addMessage({
              chatId,
              messages,
            });
          }
        } catch (error) {
          console.error("Error in onFinish handler:", error);
          throw error;
        }
      },
    });

    for await (const text of textStream) {
      stream.update({
        type: "text",
        text,
      });
    }

    stream.done();
  })();

  return stream.value;
}
