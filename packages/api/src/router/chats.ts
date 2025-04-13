import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { chatMessages, chats } from "@weldr/db/schema";
import { mergeJson } from "@weldr/db/utils";
import { S3 } from "@weldr/shared/s3";
import type { ChatMessage } from "@weldr/shared/types";
import { assistantMessageRawContentToText } from "@weldr/shared/utils";
import { addMessagesInputSchema } from "@weldr/shared/validators/chats";
import { type InferInsertModel, and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

export const chatsRouter = {
  messages: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      const messages = await ctx.db.query.chatMessages.findMany({
        where: and(
          eq(chatMessages.chatId, input.chatId),
          eq(chatMessages.userId, ctx.session.user.id),
        ),
        orderBy: (chatMessages, { asc }) => [asc(chatMessages.createdAt)],
        columns: {
          content: false,
        },
        with: {
          attachments: {
            columns: {
              name: true,
              key: true,
            },
          },
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      const messagesWithAttachments = await Promise.all(
        messages.map(async (message) => {
          const attachments = [];

          for (const attachment of message.attachments) {
            const url = await S3.getSignedUrl("weldr-general", attachment.key);

            attachments.push({
              name: attachment.name,
              url,
            });
          }

          return {
            ...message,
            attachments,
          };
        }),
      );

      return messagesWithAttachments as ChatMessage[];
    }),
  addMessage: protectedProcedure
    .input(addMessagesInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.messages.length === 0) {
        return;
      }

      const chat = await ctx.db.query.chats.findFirst({
        where: and(
          eq(chats.id, input.chatId),
          eq(chats.userId, ctx.session.user.id),
        ),
      });

      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      const messages: InferInsertModel<typeof chatMessages>[] = [];

      for (const item of input.messages) {
        // const resolvedRawContent: ResolvedRawContent[] = [];

        // FIXME: this must be resolved raw content to resolve the embedded references
        // if (item.role === "user") {
        //   resolvedRawContent.push(
        //     ...(await resolveRawContent(item.rawContent, ctx)),
        //   );
        // }

        messages.push({
          id: item.role === "user" ? item.id : undefined,
          content:
            item.role === "user"
              ? // FIXME: this must be resolved raw content to resolve the embedded references
                assistantMessageRawContentToText(item.rawContent)
              : item.role === "assistant"
                ? assistantMessageRawContentToText(item.rawContent)
                : undefined,
          rawContent: item.rawContent,
          role: item.role,
          userId: ctx.session.user.id,
          chatId: input.chatId,
        });
      }

      await ctx.db.insert(chatMessages).values(messages);
    }),
  updateMessage: protectedProcedure
    .input(
      z.object({
        where: z.object({
          messageId: z.string(),
        }),
        data: z.object({
          type: z.literal("tool"),
          toolResult: z.any(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [message] = await ctx.db
        .update(chatMessages)
        .set({
          rawContent: mergeJson(chatMessages.rawContent, {
            toolResult: input.data.toolResult,
          }),
        })
        .where(
          and(
            eq(chatMessages.id, input.where.messageId),
            eq(chatMessages.userId, ctx.session.user.id),
          ),
        )
        .returning();

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      return message;
    }),
} satisfies TRPCRouterRecord;

// async function resolveRawContent(
//   rawMessageContent: UserMessageRawContent,
//   ctx: {
//     db: typeof db;
//     session: Session;
//   },
// ): Promise<ResolvedRawContent[]> {
//   const references: ResolvedRawContent[] = [];
//   const resolvedReferencesCache = new Map<string, ResolvedReference>();
//   const cachedResourceMetadata = new Map<
//     string,
//     {
//       name: string;
//       metadata: {
//         type: "postgres" | "mysql";
//         tables: DatabaseStructure;
//       };
//     }
//   >();

//   for (const element of rawMessageContent) {
//     switch (element.type) {
//       case "paragraph": {
//         references.push({
//           type: "paragraph",
//           value: element.value,
//         });
//         break;
//       }
//       case "reference": {
//         switch (element.referenceType) {
//           case "function": {
//             if (resolvedReferencesCache.has(element.id)) {
//               // biome-ignore lint/style/noNonNullAssertion: <explanation>
//               references.push(resolvedReferencesCache.get(element.id)!);
//               break;
//             }
//             const resolvedReference = await resolveFuncReference(element, ctx);
//             resolvedReferencesCache.set(element.id, resolvedReference);
//             references.push(resolvedReference);
//             break;
//           }
//           case "resource": {
//             const key = `resource-${element.id}`;
//             if (resolvedReferencesCache.has(key)) {
//               // biome-ignore lint/style/noNonNullAssertion: <explanation>
//               references.push(resolvedReferencesCache.get(key)!);
//               break;
//             }
//             const resolvedReference = await resolveResourceReference({
//               resourceId: element.id,
//               resourceName: element.name,
//               resourceType: element.resourceType,
//               ctx,
//             });
//             resolvedReferencesCache.set(key, resolvedReference);
//             references.push(resolvedReference);
//             break;
//           }
//           case "database-table": {
//             const key = `db-table-${element.name}-${element.databaseId}`;
//             if (resolvedReferencesCache.has(key)) {
//               // biome-ignore lint/style/noNonNullAssertion: <explanation>
//               references.push(resolvedReferencesCache.get(key)!);
//               break;
//             }
//             const resolvedReference = await resolveResourceTableReference({
//               resourceId: element.databaseId,
//               tableName: element.name,
//               cachedResourceMetadataMap: cachedResourceMetadata,
//               ctx,
//             });
//             resolvedReferencesCache.set(key, resolvedReference);
//             references.push(resolvedReference);
//             break;
//           }
//           case "database-column": {
//             const key = `db-col-${element.name}-${element.databaseId}-${element.tableName}`;
//             if (resolvedReferencesCache.has(key)) {
//               // biome-ignore lint/style/noNonNullAssertion: <explanation>
//               references.push(resolvedReferencesCache.get(key)!);
//               break;
//             }
//             const resolvedReference = await resolveResourceColumnReference({
//               resourceId: element.databaseId,
//               tableName: element.tableName,
//               columnName: element.name,
//               columnDataType: element.dataType,
//               cachedResourceMetadataMap: cachedResourceMetadata,
//               ctx,
//             });
//             resolvedReferencesCache.set(key, resolvedReference);
//             references.push(resolvedReference);
//             break;
//           }
//         }
//         break;
//       }
//     }
//   }

//   return references;
// }

// function userMessageRawContentToText(
//   rawMessageContent: ResolvedRawContent[] = [],
// ): string {
//   const context: string[] = [];
//   const seenElements = new Map<string, boolean>();
//   const helperFunctions: string[] = [];

//   const getElementKey = (element: ResolvedRawContent): string => {
//     if (element.type === "paragraph") return element.value;

//     switch (element.referenceType) {
//       case "function": {
//         return `function-${element.id}`;
//       }
//       case "resource": {
//         return `resource-${element.id}`;
//       }
//       case "database-table": {
//         return `db-table-${element.name}-${element.database.id}`;
//       }
//       case "database-column": {
//         return `db-col-${element.name}-${element.database.id}-${element.table.name}`;
//       }
//       default:
//         return "";
//     }
//   };

//   const text = rawMessageContent
//     .reduce((acc, element) => {
//       switch (element.type) {
//         case "paragraph": {
//           return `${acc}${element.value}`;
//         }

//         case "reference": {
//           const key = getElementKey(element);

//           if (!seenElements.has(key)) {
//             seenElements.set(key, true);

//             // For database-related references, check if we need to add database info first
//             if (
//               element.referenceType === "database-table" ||
//               element.referenceType === "database-column"
//             ) {
//               const dbKey = `db-${element.database.id}`;
//               if (!seenElements.has(dbKey)) {
//                 seenElements.set(dbKey, true);
//                 const dbInfo = {
//                   ...element.database,
//                   type: "reference" as const,
//                   referenceType: "resource" as const,
//                   resourceType: "postgres" as const,
//                 };
//                 const { text, helpers } = referenceToText(dbInfo, seenElements);
//                 if (text) context.push(text);
//                 if (helpers) helperFunctions.push(...helpers);
//               }
//             }

//             const { text, helpers } = referenceToText(element, seenElements);
//             if (text) context.push(text);
//             if (helpers) helperFunctions.push(...helpers);
//           }
//           return `${acc}${element.name}`;
//         }
//       }
//     }, "")
//     .trim();

//   const sections = [];
//   if (context.length > 0 || helperFunctions.length > 0) {
//     sections.push("## Context\n");
//   }
//   if (context.length > 0) {
//     sections.push(context.filter(Boolean).join("\n\n"));
//   }
//   if (helperFunctions.length > 0) {
//     sections.push(helperFunctions.join("\n\n"));
//   }
//   sections.push("## Request", text);

//   return sections.join("\n\n");
// }

// function referenceToText(
//   reference: ResolvedReference,
//   seenElements: Map<string, boolean>,
// ): { text: string; helpers?: string[] } {
//   switch (reference.referenceType) {
//     case "function": {
//       return {
//         text: "",
//         helpers: [
//           `### Helper Function \`${reference.name}\` (ID: ${reference.id})`,
//           `${reference.docs}`,
//         ],
//       };
//     }

//     case "resource": {
//       const text = `### ${
//         reference.resourceType === "postgres" ? "PostgreSQL" : "MySQL"
//       } Database \`${reference.name}\` (ID: ${reference.id})`;

//       const helpers =
//         reference.helperFunctions.length > 0
//           ? reference.helperFunctions.map(
//               (util) =>
//                 `### Function \`${util.name}\` (ID: ${util.id})\n${util.docs}`,
//             )
//           : undefined;

//       return { text, helpers };
//     }

//     case "database-table": {
//       const parts = [
//         `- Table \`${reference.name}\``,
//         ...(reference.columns?.length > 0
//           ? [
//               "  - Columns:",
//               ...reference.columns.map(
//                 (col) => `- \`${col.name}\` (${col.dataType})`,
//               ),
//             ]
//           : []),
//         ...(reference.relationships && reference.relationships.length > 0
//           ? [
//               "  - Relationships:",
//               ...reference.relationships.map(
//                 (rel) =>
//                   `- \`${rel.columnName}\` -> \`${rel.referencedTable}\`.\`${rel.referencedColumn}\``,
//               ),
//             ]
//           : []),
//       ];

//       return { text: parts.join("\n") };
//     }

//     case "database-column": {
//       const tableKey = `db-table-${reference.table.name}-${reference.database.id}`;
//       if (seenElements.has(tableKey)) return { text: "" };
//       seenElements.set(tableKey, true);

//       const parts = [
//         `- Table \`${reference.table.name}\``,
//         ...(reference.table.columns.length > 0
//           ? [
//               "  - Columns:",
//               ...reference.table.columns.map(
//                 (col) => `- \`${col.name}\` (${col.dataType})`,
//               ),
//             ]
//           : []),
//         ...(reference.table.relationships &&
//         reference.table.relationships.length > 0
//           ? [
//               "  - Relationships:",
//               ...reference.table.relationships.map(
//                 (rel) =>
//                   `- \`${rel.columnName}\` -> \`${rel.referencedTable}\`.\`${rel.referencedColumn}\``,
//               ),
//             ]
//           : []),
//       ];

//       return { text: parts.join("\n") };
//     }

//     default: {
//       return { text: "" };
//     }
//   }
// }

// async function resolveFuncReference(
//   reference: {
//     id: string;
//     name: string;
//     type: "reference";
//     referenceType: "function";
//   },
//   ctx: {
//     db: typeof db;
//     session: Session;
//   },
// ): Promise<ResolvedFuncReference> {
//   const func = await ctx.db.query.funcs.findFirst({
//     where: and(
//       eq(funcs.id, reference.id),
//       eq(funcs.userId, ctx.session.user.id),
//       isNotNull(funcs.currentDefinitionId),
//     ),
//     with: {
//       currentDefinition: true,
//     },
//   });

//   if (!func) {
//     throw new TRPCError({
//       code: "NOT_FOUND",
//       message: "Function not found",
//     });
//   }

//   if (!func.currentDefinition) {
//     throw new TRPCError({
//       code: "BAD_REQUEST",
//       message: "Function is missing required fields",
//     });
//   }

//   return {
//     type: "reference",
//     referenceType: "function",
//     id: func.id,
//     name: func.currentDefinition.name,
//     docs: func.currentDefinition.docs,
//   };
// }

// async function resolveResourceReference({
//   resourceId,
//   resourceName,
//   resourceType,
//   ctx,
// }: {
//   resourceId: string;
//   resourceName: string;
//   resourceType: "postgres" | "mysql";
//   ctx: {
//     db: typeof db;
//     session: Session;
//   };
// }): Promise<ResolvedDatabaseReference> {
//   const helperFunctions = await getResourceHelperFunctions(resourceId, ctx);
//   return {
//     id: resourceId,
//     type: "reference",
//     name: resourceName,
//     referenceType: "resource",
//     resourceType: resourceType,
//     helperFunctions,
//   };
// }

// async function resolveResourceTableReference({
//   resourceId,
//   tableName,
//   cachedResourceMetadataMap,
//   ctx,
// }: {
//   resourceId: string;
//   tableName: string;
//   cachedResourceMetadataMap: Map<
//     string,
//     {
//       name: string;
//       metadata: {
//         type: "postgres" | "mysql";
//         tables: DatabaseStructure;
//       };
//     }
//   >;
//   ctx: {
//     db: typeof db;
//     session: Session;
//   };
// }): Promise<ResolvedDatabaseTableReference> {
//   const resource =
//     cachedResourceMetadataMap.get(resourceId) ??
//     (await getResourceMetadata(resourceId, ctx));

//   if (!cachedResourceMetadataMap.get(resourceId)) {
//     cachedResourceMetadataMap.set(resourceId, resource);
//   }

//   const helperFunctions = await getResourceHelperFunctions(resourceId, ctx);

//   return {
//     type: "reference",
//     name: tableName,
//     referenceType: "database-table",
//     database: {
//       id: resourceId,
//       name: resource.name,
//       resourceType: resource.metadata.type,
//       helperFunctions,
//     },
//     columns:
//       resource.metadata.tables.find(
//         (table) => table.name === tableName.split(".")[1],
//       )?.columns ?? [],
//     relationships: resource.metadata.tables.find(
//       (table) => table.name === tableName.split(".")[1],
//     )?.relationships,
//   };
// }

// async function resolveResourceColumnReference({
//   resourceId,
//   tableName,
//   columnName,
//   columnDataType,
//   cachedResourceMetadataMap,
//   ctx,
// }: {
//   resourceId: string;
//   tableName: string;
//   columnName: string;
//   columnDataType: string;
//   cachedResourceMetadataMap: Map<
//     string,
//     {
//       name: string;
//       metadata: {
//         type: "postgres" | "mysql";
//         tables: DatabaseStructure;
//       };
//     }
//   >;
//   ctx: {
//     db: typeof db;
//     session: Session;
//   };
// }): Promise<ResolvedDatabaseColumnReference> {
//   const resource =
//     cachedResourceMetadataMap.get(resourceId) ??
//     (await getResourceMetadata(resourceId, ctx));

//   if (!cachedResourceMetadataMap.get(resourceId)) {
//     cachedResourceMetadataMap.set(resourceId, resource);
//   }

//   const helperFunctions = await getResourceHelperFunctions(resourceId, ctx);

//   return {
//     type: "reference",
//     referenceType: "database-column",
//     name: columnName,
//     dataType: columnDataType,
//     table: {
//       // biome-ignore lint/style/noNonNullAssertion: <explanation>
//       name: tableName.split(".")[1]!,
//       columns:
//         resource.metadata.tables.find(
//           (table) => table.name === tableName.split(".")[1],
//         )?.columns ?? [],
//       relationships: resource.metadata.tables.find(
//         (table) => table.name === tableName.split(".")[1],
//       )?.relationships,
//     },
//     database: {
//       id: resourceId,
//       name: resource.name,
//       resourceType: resource.metadata.type,
//       helperFunctions,
//     },
//   };
// }

// async function getResourceHelperFunctions(
//   resourceId: string,
//   ctx: {
//     session: Session;
//     db: typeof db;
//   },
// ) {
//   const resourceResult = await ctx.db.query.resources.findFirst({
//     where: and(
//       eq(resources.id, resourceId),
//       eq(resources.userId, ctx.session.user.id),
//     ),
//     with: {
//       integration: {
//         with: {
//           funcs: {
//             with: {
//               currentDefinition: true,
//             },
//           },
//         },
//       },
//     },
//   });

//   if (!resourceResult) {
//     throw new TRPCError({
//       code: "NOT_FOUND",
//       message: "Resource not found",
//     });
//   }

//   const helperFunctions = resourceResult.integration.funcs
//     .map((func) => {
//       if (func.currentDefinition) {
//         return func;
//       }
//     })
//     .filter((func) => func !== undefined);

//   return helperFunctions
//     .map((func) => {
//       if (!func.currentDefinition) {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: "Function is missing required fields",
//         });
//       }

//       return {
//         id: func.id,
//         name: func.currentDefinition.name,
//         docs: func.currentDefinition.docs,
//       };
//     })
//     .filter((func) => func !== undefined);
// }

// async function getResourceMetadata(
//   resourceId: string,
//   ctx: {
//     db: typeof db;
//     session: Session;
//   },
// ): Promise<{
//   name: string;
//   metadata: {
//     type: "postgres" | "mysql";
//     tables: DatabaseStructure;
//   };
// }> {
//   const resource = await ctx.db.query.resources.findFirst({
//     where: and(
//       eq(resources.id, resourceId),
//       eq(resources.userId, ctx.session.user.id),
//     ),
//     with: {
//       integration: {
//         columns: {
//           type: true,
//         },
//       },
//     },
//   });

//   if (!resource) {
//     throw new TRPCError({
//       code: "NOT_FOUND",
//       message: "Resource not found",
//     });
//   }

//   let metadata: {
//     type: "postgres" | "mysql";
//     tables: DatabaseStructure;
//   } | null = null;

//   switch (resource.integration.type) {
//     case "postgres": {
//       const resourceEnvironmentVariablesResult =
//         await ctx.db.query.resourceEnvironmentVariables.findMany({
//           where: eq(resourceEnvironmentVariables.resourceId, resourceId),
//           with: {
//             environmentVariable: true,
//           },
//         });

//       const environmentVariables = await Promise.all(
//         resourceEnvironmentVariablesResult.map(async (item) => {
//           const secret = (
//             await ctx.db.execute(
//               sql`select decrypted_secret from vault.decrypted_secrets where id=${item.environmentVariable.secretId}`,
//             )
//           ).rows[0];

//           if (!secret) {
//             throw new TRPCError({
//               code: "NOT_FOUND",
//               message: "Secret not found",
//             });
//           }

//           return {
//             key: item.environmentVariable.key,
//             value: secret.decrypted_secret,
//           } as {
//             key: string;
//             value: string;
//           };
//         }),
//       );

//       const config = environmentVariables.reduce(
//         (acc: DbConfig, { key, value }: { key: string; value: string }) => {
//           const mapping: Record<string, keyof typeof acc> = {
//             POSTGRES_HOST: "host",
//             POSTGRES_PORT: "port",
//             POSTGRES_DB: "database",
//             POSTGRES_USER: "user",
//             POSTGRES_PASSWORD: "password",
//           };
//           // @ts-ignore
//           acc[mapping[key]] = value;
//           return acc;
//         },
//         {} as DbConfig,
//       );

//       const databaseStructure = await getDatabaseStructure(config);
//       metadata = {
//         type: resource.integration.type,
//         tables: databaseStructure,
//       };
//       break;
//     }
//     default: {
//       throw new TRPCError({
//         code: "NOT_FOUND",
//         message: "Resource not found",
//       });
//     }
//   }

//   return {
//     name: resource.name,
//     metadata,
//   };
// }
