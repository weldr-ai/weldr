"use server";

import { insertMessages } from "@/lib/ai/insert-messages";
import { prompts } from "@/lib/ai/prompts";
import { registry } from "@/lib/ai/registry";
import {
  executeSetupIntegrationTool,
  setupIntegrationTool,
} from "@/lib/ai/tools";
import { coderTool, executeCoderTool } from "@/lib/ai/tools/coder";
import { convertMessagesToCoreMessages } from "@/lib/ai/utils";
import type { TStreamableValue } from "@/types";
import { auth } from "@weldr/auth";
import { and, db, eq, isNotNull } from "@weldr/db";
import {
  chats,
  declarationPackages,
  declarations,
  dependencies,
  files,
  integrations,
  packages,
  presets,
  projects,
  themes,
  versionDeclarations,
  versionFiles,
  versionPackages,
  versions,
} from "@weldr/db/schema";
import type { UserMessageRawContent } from "@weldr/shared/types";
import type { attachmentSchema } from "@weldr/shared/validators/chats";
import { streamText } from "ai";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import redis from "redis";
import type { z } from "zod";

const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});

export async function POST(request: Request) {
  const { projectId, message } = (await request.json()) as {
    projectId: string;
    message?: {
      content: UserMessageRawContent;
      attachments: z.infer<typeof attachmentSchema>[];
    };
  };
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

  const devNodeId = await redisClient.get(`${projectId}:dev-node-id`);

  if (!devNodeId) {
    throw new Error("Development node not found");
  }

  const integrationsList = await db.query.integrations.findMany({
    where: eq(integrations.projectId, projectId),
    with: {
      integrationTemplate: true,
    },
  });

  const allIntegrationTemplates =
    await db.query.integrationTemplates.findMany();

  let activeVersion = await db.query.versions.findFirst({
    where: and(
      eq(versions.projectId, projectId),
      isNotNull(versions.activatedAt),
    ),
  });

  if (!activeVersion || activeVersion.progress === "succeeded") {
    activeVersion = await initializeVersion({
      projectId,
      userId: session.user.id,
    });
  }

  if (message) {
    await insertMessages({
      input: {
        chatId: activeVersion.chatId,
        userId: session.user.id,
        messages: [
          {
            role: "user",
            rawContent: message.content,
            attachmentIds: message.attachments.map(
              (attachment) => attachment.id,
            ),
          },
        ],
      },
    });
  }

  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, activeVersion.chatId),
    with: {
      messages: {
        orderBy: (chatMessages, { asc }) => [asc(chatMessages.createdAt)],
        columns: {
          role: true,
          content: true,
          rawContent: true,
        },
      },
    },
  });

  if (!chat) {
    throw new Error("Chat not found");
  }

  const promptMessages = convertMessagesToCoreMessages(chat.messages);

  const stream = new TransformStream<TStreamableValue>({
    async transform(chunk, controller) {
      controller.enqueue(`${JSON.stringify(chunk)}|CHUNK|`);
    },
  });

  const streamWriter = stream.writable.getWriter();

  (async () => {
    try {
      if (activeVersion && activeVersion.progress !== "succeeded") {
        await executeCoderTool({
          userId: session.user.id,
          projectId,
          machineId: devNodeId,
          promptMessages,
          streamWriter,
          version: activeVersion,
        });
      } else {
        const result = streamText({
          model: registry.languageModel("openai:gpt-4.1"),
          system: prompts.requirementsGatherer(
            activeVersion
              ? `You are working on a project called ${project.name} that was initiated at ${activeVersion.createdAt.toISOString()}

This project has the following integrations setup:
${integrationsList
  .map((integration) => `- ${integration.integrationTemplate.name}`)
  .join(", ")}`
              : "This is a new project",
            allIntegrationTemplates
              .map(
                (integrationTemplate) =>
                  `- ${integrationTemplate.name} (key: ${integrationTemplate.key}):
Type: ${integrationTemplate.type}
Description: ${integrationTemplate.description}`,
              )
              .join("\n\n"),
          ),
          messages: promptMessages,
          tools: {
            coderTool,
            setupIntegrationTool,
          },
          maxSteps: 3,
          onFinish: async ({ text, finishReason, toolCalls }) => {
            if (finishReason === "stop" && text) {
              console.log(`[api/generate:onFinish:${projectId}] ${text}`);
              await insertMessages({
                input: {
                  chatId: activeVersion.chatId,
                  userId: session.user.id,
                  messages: [
                    {
                      role: "assistant",
                      rawContent: [{ type: "paragraph", value: text }],
                    },
                  ],
                },
              });
            }

            if (finishReason === "tool-calls") {
              console.log(
                `[api/generate:onFinish:${projectId}] Tool calls: ${JSON.stringify(toolCalls)}`,
              );

              if (text) {
                await insertMessages({
                  input: {
                    chatId: activeVersion.chatId,
                    userId: session.user.id,
                    messages: [
                      {
                        role: "assistant",
                        rawContent: [{ type: "paragraph", value: text }],
                      },
                    ],
                  },
                });
              }

              for (const toolCall of toolCalls) {
                switch (toolCall.toolName) {
                  case "coderTool": {
                    console.log(
                      `[api/generate:onFinish:${projectId}] Executing coder tool`,
                    );
                    await executeCoderTool({
                      version: activeVersion,
                      userId: session.user.id,
                      projectId,
                      machineId: devNodeId,
                      promptMessages,
                      streamWriter,
                      toolArgs: toolCall.args,
                    });
                    break;
                  }
                  case "setupIntegrationTool": {
                    console.log(
                      `[api/generate:onFinish:${projectId}] Executing setup integration tool`,
                    );
                    await executeSetupIntegrationTool({
                      chatId: activeVersion.chatId,
                      userId: session.user.id,
                      toolArgs: toolCall.args,
                      streamWriter,
                    });
                    break;
                  }
                }
              }
            }
          },
          onError: (error) => {
            console.error(
              `[api/generate:onError:${projectId}] ${JSON.stringify(error, null, 2)}`,
            );
          },
        });

        for await (const chunk of result.textStream) {
          await streamWriter.write({
            type: "paragraph",
            text: chunk,
          });
        }

        const usageData = await result.usage;

        console.log(
          `[api/generate:${projectId}] Prompt Tokens: ${usageData.promptTokens} + Completion Tokens: ${usageData.completionTokens} = Total Tokens: ${usageData.totalTokens}`,
        );
      }
    } finally {
      console.log("Closing stream writer");
      await streamWriter.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
    },
  });
}

const initializeVersion = async ({
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

        return {
          versionId: version.id,
          fileId: file.id,
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
