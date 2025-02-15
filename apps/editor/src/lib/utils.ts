import type { DatabaseStructure } from "@weldr/shared/integrations/postgres/types";
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

export function getResourceReferences(
  resources: {
    id: string;
    name: string;
    integrationType: "postgres" | "mysql";
    metadata?: unknown;
  }[],
): z.infer<typeof userMessageRawContentReferenceElementSchema>[] {
  const references: z.infer<
    typeof userMessageRawContentReferenceElementSchema
  >[] = [];

  for (const resource of resources ?? []) {
    references.push({
      id: resource.id,
      type: "reference",
      name: resource.name,
      referenceType: "resource",
      resourceType: resource.integrationType,
    });

    if (
      resource.integrationType === "postgres" ||
      resource.integrationType === "mysql"
    ) {
      const databaseStructure = resource.metadata as DatabaseStructure;

      for (const table of databaseStructure) {
        for (const column of table.columns) {
          references.push({
            type: "reference",
            name: `${resource.name}.${table.name}.${column.name}`,
            referenceType: "database-column",
            dataType: column.dataType,
            databaseId: resource.id,
            tableName: table.name,
          });
        }

        references.push({
          type: "reference",
          name: `${resource.name}.${table.name}`,
          referenceType: "database-table",
          databaseId: resource.id,
        });
      }
    }
  }

  return references;
}
