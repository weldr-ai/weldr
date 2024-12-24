import type { Session } from "@integramind/auth";
import type { db } from "@integramind/db";
import {
  conversationMessages,
  conversations,
  funcs,
  resourceEnvironmentVariables,
  resources,
} from "@integramind/db/schema";
import { getDatabaseStructure } from "@integramind/shared/integrations/postgres/helpers";
import type {
  DatabaseStructure,
  DbConfig,
} from "@integramind/shared/integrations/types";
import type { UserMessageRawContent } from "@integramind/shared/types";
import {
  assistantMessageRawContentSchema,
  userMessageRawContentSchema,
} from "@integramind/shared/validators/conversations";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../trpc";

interface ResolvedFuncReference {
  type: "reference";
  referenceType: "function";
  id: string;
  name: string;
  docs: string;
  moduleName: string;
}

interface ResolvedDatabaseReference {
  type: "reference";
  referenceType: "database";
  id: string;
  name: string;
  databaseType: "postgres" | "mysql";
  helperFunctions: {
    id: string;
    name: string;
    docs: string;
  }[];
}

interface ResolvedDatabaseTableReference {
  type: "reference";
  referenceType: "database-table";
  name: string;
  columns: {
    name: string;
    dataType: string;
  }[];
  relationships:
    | {
        columnName: string;
        referencedTable: string;
        referencedColumn: string;
      }[]
    | undefined;
  database: Omit<ResolvedDatabaseReference, "type" | "referenceType">;
}

interface ResolvedDatabaseColumnReference {
  type: "reference";
  referenceType: "database-column";
  name: string;
  dataType: string;
  table: {
    name: string;
    columns: {
      name: string;
      dataType: string;
    }[];
    relationships:
      | {
          columnName: string;
          referencedTable: string;
          referencedColumn: string;
        }[]
      | undefined;
  };
  database: Omit<ResolvedDatabaseReference, "type" | "referenceType">;
}

type ResolvedReference =
  | ResolvedFuncReference
  | ResolvedDatabaseReference
  | ResolvedDatabaseTableReference
  | ResolvedDatabaseColumnReference;

type ResolvedRawContent =
  | {
      type: "text";
      value: string;
    }
  | ResolvedReference;

export const conversationsRouter = {
  addMessage: protectedProcedure
    .input(
      z.discriminatedUnion("role", [
        z.object({
          role: z.literal("assistant"),
          rawContent: assistantMessageRawContentSchema,
          content: z.string(),
          conversationId: z.string(),
        }),
        z.object({
          role: z.literal("user"),
          rawContent: userMessageRawContentSchema,
          conversationId: z.string(),
          funcId: z.string().optional(),
        }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await ctx.db.query.conversations.findFirst({
        where: and(
          eq(conversations.id, input.conversationId),
          eq(conversations.userId, ctx.session.user.id),
        ),
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      if (input.role === "assistant") {
        await ctx.db.insert(conversationMessages).values({
          content: input.content,
          rawContent: input.rawContent,
          role: "assistant",
          createdAt: new Date(),
          userId: ctx.session.user.id,
          conversationId: input.conversationId,
        });
      }

      if (input.role === "user") {
        let currentModuleId: string | null = null;

        if (input.funcId) {
          const funcResult = await ctx.db.query.funcs.findFirst({
            where: eq(funcs.id, input.funcId),
            columns: {
              moduleId: true,
            },
          });

          if (!funcResult) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Function not found",
            });
          }

          currentModuleId = funcResult.moduleId;
        }

        const resolvedRawContent = await resolveRawContent(
          input.rawContent,
          currentModuleId,
          ctx,
        );

        await ctx.db.insert(conversationMessages).values({
          content: userMessageRawContentToText(resolvedRawContent),
          rawContent: input.rawContent,
          role: "user",
          createdAt: new Date(),
          userId: ctx.session.user.id,
          conversationId: input.conversationId,
        });
      }
    }),
} satisfies TRPCRouterRecord;

async function resolveRawContent(
  rawMessageContent: UserMessageRawContent,
  currentModuleId: string | null,
  ctx: {
    db: typeof db;
    session: Session;
  },
): Promise<ResolvedRawContent[]> {
  const references: ResolvedRawContent[] = [];
  const resolvedReferencesCache = new Map<string, ResolvedReference>();
  const cachedResourceMetadata = new Map<
    string,
    {
      name: string;
      metadata: {
        type: "postgres" | "mysql";
        tables: DatabaseStructure;
      };
    }
  >();

  for (const element of rawMessageContent) {
    switch (element.type) {
      case "text": {
        references.push({
          type: "text",
          value: element.value,
        });
        break;
      }
      case "reference": {
        switch (element.referenceType) {
          case "function": {
            if (resolvedReferencesCache.has(element.id)) {
              // biome-ignore lint/style/noNonNullAssertion: <explanation>
              references.push(resolvedReferencesCache.get(element.id)!);
              break;
            }
            const resolvedReference = await resolveFuncReference(
              element,
              currentModuleId,
              ctx,
            );
            resolvedReferencesCache.set(element.id, resolvedReference);
            references.push(resolvedReference);
            break;
          }
          case "resource": {
            const key = `resource-${element.id}`;
            if (resolvedReferencesCache.has(key)) {
              // biome-ignore lint/style/noNonNullAssertion: <explanation>
              references.push(resolvedReferencesCache.get(key)!);
              break;
            }
            const resolvedReference = await resolveResourceReference({
              resourceId: element.id,
              resourceName: element.name,
              resourceType: element.resourceType,
              ctx,
            });
            resolvedReferencesCache.set(key, resolvedReference);
            references.push(resolvedReference);
            break;
          }
          case "database-table": {
            const key = `db-table-${element.name}-${element.databaseId}`;
            if (resolvedReferencesCache.has(key)) {
              // biome-ignore lint/style/noNonNullAssertion: <explanation>
              references.push(resolvedReferencesCache.get(key)!);
              break;
            }
            const resolvedReference = await resolveResourceTableReference({
              resourceId: element.databaseId,
              tableName: element.name,
              cachedResourceMetadataMap: cachedResourceMetadata,
              ctx,
            });
            resolvedReferencesCache.set(key, resolvedReference);
            references.push(resolvedReference);
            break;
          }
          case "database-column": {
            const key = `db-col-${element.name}-${element.databaseId}-${element.tableName}`;
            if (resolvedReferencesCache.has(key)) {
              // biome-ignore lint/style/noNonNullAssertion: <explanation>
              references.push(resolvedReferencesCache.get(key)!);
              break;
            }
            const resolvedReference = await resolveResourceColumnReference({
              resourceId: element.databaseId,
              tableName: element.tableName,
              columnName: element.name,
              columnDataType: element.dataType,
              cachedResourceMetadataMap: cachedResourceMetadata,
              ctx,
            });
            resolvedReferencesCache.set(key, resolvedReference);
            references.push(resolvedReference);
            break;
          }
        }
        break;
      }
    }
  }

  return references;
}

function userMessageRawContentToText(
  rawMessageContent: ResolvedRawContent[] = [],
): string {
  const context: string[] = [];
  const seenElements = new Map<string, boolean>();
  const helperFunctions: string[] = [];

  const getElementKey = (element: ResolvedRawContent): string => {
    if (element.type === "text") return element.value;

    switch (element.referenceType) {
      case "function": {
        return `function-${element.id}`;
      }
      case "database": {
        return `db-${element.id}`;
      }
      case "database-table": {
        return `db-table-${element.name}-${element.database.id}`;
      }
      case "database-column": {
        return `db-col-${element.name}-${element.database.id}-${element.table.name}`;
      }
      default:
        return "";
    }
  };

  const text = rawMessageContent
    .reduce((acc, element) => {
      switch (element.type) {
        case "text": {
          return `${acc}${element.value}`;
        }

        case "reference": {
          const key = getElementKey(element);

          if (!seenElements.has(key)) {
            seenElements.set(key, true);

            // For database-related references, check if we need to add database info first
            if (
              element.referenceType === "database-table" ||
              element.referenceType === "database-column"
            ) {
              const dbKey = `db-${element.database.id}`;
              if (!seenElements.has(dbKey)) {
                seenElements.set(dbKey, true);
                const dbInfo = {
                  ...element.database,
                  type: "reference" as const,
                  referenceType: "database" as const,
                  databaseType: "postgres" as const,
                };
                const { text, helpers } = referenceToText(dbInfo, seenElements);
                if (text) context.push(text);
                if (helpers) helperFunctions.push(...helpers);
              }
            }

            const { text, helpers } = referenceToText(element, seenElements);
            if (text) context.push(text);
            if (helpers) helperFunctions.push(...helpers);
          }
          return `${acc}${element.name}`;
        }
      }
    }, "")
    .trim();

  const sections = [];
  if (context.length > 0) {
    sections.push("## Context", context.filter(Boolean).join("\n\n"));
  }
  if (helperFunctions.length > 0) {
    sections.push(helperFunctions.join("\n"));
  }
  sections.push("## Request", text);

  return sections.join("\n\n");
}

function referenceToText(
  reference: ResolvedReference,
  seenElements: Map<string, boolean>,
): { text: string; helpers?: string[] } {
  switch (reference.referenceType) {
    case "function": {
      return {
        text: "",
        helpers: [
          `### Function \`${reference.name}\` (ID: ${reference.id})`,
          `${reference.docs}`,
        ],
      };
    }

    case "database": {
      const text = `### ${
        reference.databaseType === "postgres" ? "PostgreSQL" : "MySQL"
      } Database \`${reference.name}\` (ID: ${reference.id})`;

      const helpers =
        reference.helperFunctions.length > 0
          ? reference.helperFunctions.map(
              (util) =>
                `### Function \`${util.name}\` (ID: ${util.id})\n${util.docs}`,
            )
          : undefined;

      return { text, helpers };
    }

    case "database-table": {
      const parts = [
        `- Table \`${reference.name}\``,
        ...(reference.columns?.length > 0
          ? [
              "  - Columns:",
              ...reference.columns.map(
                (col) => `- \`${col.name}\` (${col.dataType})`,
              ),
            ]
          : []),
        ...(reference.relationships && reference.relationships.length > 0
          ? [
              "  - Relationships:",
              ...reference.relationships.map(
                (rel) =>
                  `- \`${rel.columnName}\` -> \`${rel.referencedTable}\`.\`${rel.referencedColumn}\``,
              ),
            ]
          : []),
      ];

      return { text: parts.join("\n") };
    }

    case "database-column": {
      const tableKey = `db-table-${reference.table.name}-${reference.database.id}`;
      if (seenElements.has(tableKey)) return { text: "" };
      seenElements.set(tableKey, true);

      const parts = [
        `- Table \`${reference.table.name}\``,
        ...(reference.table.columns.length > 0
          ? [
              "  - Columns:",
              ...reference.table.columns.map(
                (col) => `- \`${col.name}\` (${col.dataType})`,
              ),
            ]
          : []),
        ...(reference.table.relationships &&
        reference.table.relationships.length > 0
          ? [
              "  - Relationships:",
              ...reference.table.relationships.map(
                (rel) =>
                  `- \`${rel.columnName}\` -> \`${rel.referencedTable}\`.\`${rel.referencedColumn}\``,
              ),
            ]
          : []),
      ];

      return { text: parts.join("\n") };
    }

    default: {
      return { text: "" };
    }
  }
}

async function resolveFuncReference(
  reference: {
    id: string;
    name: string;
    type: "reference";
    referenceType: "function";
  },
  currentModuleId: string | null,
  ctx: {
    db: typeof db;
  },
): Promise<ResolvedFuncReference> {
  const func = await ctx.db.query.funcs.findFirst({
    where: eq(funcs.id, reference.id),
    with: {
      module: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!func) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Function not found",
    });
  }

  if (!func.name || !func.docs || !func.module.name) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Function is missing required fields",
    });
  }

  return {
    type: "reference",
    referenceType: "function",
    id: func.id,
    name: func.name,
    docs: func.docs,
    moduleName: func.module.name,
  };
}

async function resolveResourceReference({
  resourceId,
  resourceName,
  resourceType,
  ctx,
}: {
  resourceId: string;
  resourceName: string;
  resourceType: "postgres" | "mysql";
  ctx: {
    db: typeof db;
    session: Session;
  };
}): Promise<ResolvedDatabaseReference> {
  const helperFunctions = await getResourceHelperFunctions(resourceId, ctx);
  return {
    id: resourceId,
    type: "reference",
    name: resourceName,
    referenceType: "database",
    databaseType: resourceType,
    helperFunctions,
  };
}

async function resolveResourceTableReference({
  resourceId,
  tableName,
  cachedResourceMetadataMap,
  ctx,
}: {
  resourceId: string;
  tableName: string;
  cachedResourceMetadataMap: Map<
    string,
    {
      name: string;
      metadata: {
        type: "postgres" | "mysql";
        tables: DatabaseStructure;
      };
    }
  >;
  ctx: {
    db: typeof db;
    session: Session;
  };
}): Promise<ResolvedDatabaseTableReference> {
  const resource =
    cachedResourceMetadataMap.get(resourceId) ??
    (await getResourceMetadata(resourceId, ctx));

  if (!cachedResourceMetadataMap.get(resourceId)) {
    cachedResourceMetadataMap.set(resourceId, resource);
  }

  const helperFunctions = await getResourceHelperFunctions(resourceId, ctx);

  return {
    type: "reference",
    name: resource.name,
    referenceType: "database-table",
    database: {
      id: resourceId,
      name: resource.name,
      databaseType: resource.metadata.type,
      helperFunctions,
    },
    columns:
      resource.metadata.tables.find((table) => table.name === tableName)
        ?.columns ?? [],
    relationships: resource.metadata.tables.find(
      (table) => table.name === tableName,
    )?.relationships,
  };
}

async function resolveResourceColumnReference({
  resourceId,
  tableName,
  columnName,
  columnDataType,
  cachedResourceMetadataMap,
  ctx,
}: {
  resourceId: string;
  tableName: string;
  columnName: string;
  columnDataType: string;
  cachedResourceMetadataMap: Map<
    string,
    {
      name: string;
      metadata: {
        type: "postgres" | "mysql";
        tables: DatabaseStructure;
      };
    }
  >;
  ctx: {
    db: typeof db;
    session: Session;
  };
}): Promise<ResolvedDatabaseColumnReference> {
  const resource =
    cachedResourceMetadataMap.get(resourceId) ??
    (await getResourceMetadata(resourceId, ctx));

  if (!cachedResourceMetadataMap.get(resourceId)) {
    cachedResourceMetadataMap.set(resourceId, resource);
  }

  const helperFunctions = await getResourceHelperFunctions(resourceId, ctx);

  return {
    type: "reference",
    referenceType: "database-column",
    name: columnName,
    dataType: columnDataType,
    table: {
      name: tableName,
      columns:
        resource.metadata.tables.find((table) => table.name === tableName)
          ?.columns ?? [],
      relationships: resource.metadata.tables.find(
        (table) => table.name === tableName,
      )?.relationships,
    },
    database: {
      id: resourceId,
      name: resource.name,
      databaseType: resource.metadata.type,
      helperFunctions,
    },
  };
}

async function getResourceHelperFunctions(
  resourceId: string,
  ctx: {
    session: Session;
    db: typeof db;
  },
) {
  const resourceResult = await ctx.db.query.resources.findFirst({
    where: eq(resources.id, resourceId),
    with: {
      integration: {
        with: {
          modules: {
            with: {
              funcs: true,
            },
          },
        },
      },
    },
  });

  if (!resourceResult) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Resource not found",
    });
  }

  const helperFunctions = resourceResult.integration.modules
    .flatMap((module) =>
      module.funcs.map((func) => {
        if (func.name && func.docs) {
          return {
            ...func,
            moduleName: module.name,
          };
        }
      }),
    )
    .filter((func) => func !== undefined);

  return helperFunctions
    .map((func) => {
      if (!func.name || !func.docs) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Function is missing required fields",
        });
      }

      return {
        id: func.id,
        name: func.name,
        docs: func.docs,
      };
    })
    .filter((func) => func !== undefined);
}

async function getResourceMetadata(
  resourceId: string,
  ctx: {
    db: typeof db;
  },
): Promise<{
  name: string;
  metadata: {
    type: "postgres" | "mysql";
    tables: DatabaseStructure;
  };
}> {
  const resource = await ctx.db.query.resources.findFirst({
    where: eq(resources.id, resourceId),
    with: {
      integration: {
        columns: {
          type: true,
        },
      },
    },
  });

  if (!resource) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Resource not found",
    });
  }

  let metadata: {
    type: "postgres" | "mysql";
    tables: DatabaseStructure;
  } | null = null;

  switch (resource.integration.type) {
    case "postgres": {
      const resourceEnvironmentVariablesResult =
        await ctx.db.query.resourceEnvironmentVariables.findMany({
          where: eq(resourceEnvironmentVariables.resourceId, resourceId),
          with: {
            environmentVariable: true,
          },
        });

      const environmentVariables = await Promise.all(
        resourceEnvironmentVariablesResult.map(async (item) => {
          const secret = (
            await ctx.db.execute(
              sql`select decrypted_secret from vault.decrypted_secrets where id=${item.environmentVariable.secretId}`,
            )
          ).rows[0];

          if (!secret) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Secret not found",
            });
          }

          return {
            key: item.environmentVariable.key,
            value: secret.decrypted_secret,
          } as {
            key: string;
            value: string;
          };
        }),
      );

      const config = environmentVariables.reduce(
        (acc: DbConfig, { key, value }: { key: string; value: string }) => {
          const mapping: Record<string, keyof typeof acc> = {
            POSTGRES_HOST: "host",
            POSTGRES_PORT: "port",
            POSTGRES_DB: "database",
            POSTGRES_USER: "user",
            POSTGRES_PASSWORD: "password",
          };
          // @ts-ignore
          acc[mapping[key]] = value;
          return acc;
        },
        {} as DbConfig,
      );

      const databaseStructure = await getDatabaseStructure(config);
      metadata = {
        type: resource.integration.type,
        tables: databaseStructure,
      };
      break;
    }
    default: {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Resource not found",
      });
    }
  }

  return {
    name: resource.name,
    metadata,
  };
}
