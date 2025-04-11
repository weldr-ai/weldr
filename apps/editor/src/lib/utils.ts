import type { userMessageRawContentReferenceElementSchema } from "@weldr/shared/validators/chats";
import type { z } from "zod";

export function shortenFileName(fileName: string, maxLength = 20): string {
  if (fileName.length <= maxLength) {
    return fileName;
  }

  const ellipsis = "...";
  const availableCharacters = maxLength - ellipsis.length;

  if (availableCharacters <= 0) {
    return fileName.substring(0, maxLength);
  }

  const start = fileName.substring(0, 9);
  const end = fileName.substring(fileName.length - 8);

  return start + ellipsis + end;
}

export function getIntegrationReferences(
  integrations: {
    id: string;
    name: string;
    integrationType: "postgres";
    metadata?: unknown;
  }[],
): z.infer<typeof userMessageRawContentReferenceElementSchema>[] {
  const references: z.infer<
    typeof userMessageRawContentReferenceElementSchema
  >[] = [];

  for (const integration of integrations ?? []) {
    references.push({
      id: integration.id,
      type: "reference",
      name: integration.name,
      referenceType: "integration",
      integrationType: integration.integrationType,
    });

    if (integration.integrationType === "postgres") {
      const databaseStructure = integration.metadata;

      // @ts-expect-error - FIXME: fix this
      for (const table of databaseStructure) {
        for (const column of table.columns) {
          references.push({
            type: "reference",
            name: `${integration.name}.${table.name}.${column.name}`,
            referenceType: "database-column",
            dataType: column.dataType,
            databaseId: integration.id,
            tableName: table.name,
          });
        }

        references.push({
          type: "reference",
          name: `${integration.name}.${table.name}`,
          referenceType: "database-table",
          databaseId: integration.id,
        });
      }
    }
  }

  return references;
}
