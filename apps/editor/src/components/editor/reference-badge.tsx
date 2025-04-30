import type { rawContentReferenceElementSchema } from "@weldr/shared/validators/common";
import { PostgresIcon } from "@weldr/ui/icons";
import { cn, renderDataTypeIcon } from "@weldr/ui/lib/utils";
import { ColumnsIcon, FunctionSquareIcon, TableIcon } from "lucide-react";
import React from "react";
import type { z } from "zod";

interface ReferenceBadgeProps {
  reference: z.infer<typeof rawContentReferenceElementSchema>;
  className?: string;
}

export function ReferenceBadge({ reference, className }: ReferenceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border bg-accent px-1.5 py-0.5 text-accent-foreground text-xs",
        className,
      )}
    >
      {reference.referenceType === "variable" ? (
        Array.isArray(reference.dataType) ? (
          reference.dataType.map((type, index) => (
            <React.Fragment key={type}>
              {index > 0 && " | "}
              {renderDataTypeIcon(type)}
            </React.Fragment>
          ))
        ) : (
          renderDataTypeIcon(reference.dataType)
        )
      ) : reference.referenceType === "integration" ? (
        <>
          {reference.integrationType === "postgres" ? (
            <PostgresIcon className="mr-1 size-3 text-primary" />
          ) : (
            <></>
          )}
        </>
      ) : reference.referenceType === "database-column" ? (
        <ColumnsIcon className="mr-1 size-3 text-primary" />
      ) : reference.referenceType === "database-table" ? (
        <TableIcon className="mr-1 size-3 text-primary" />
      ) : reference.referenceType === "function" ? (
        <FunctionSquareIcon className="mr-1 size-3 text-primary" />
      ) : (
        <></>
      )}
      {reference.name}
    </span>
  );
}
