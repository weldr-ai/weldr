import { renderDataTypeIcon } from "@integramind/shared/utils";
import type { rawContentReferenceElementSchema } from "@integramind/shared/validators/common";
import { PostgresIcon } from "@integramind/ui/icons/postgres-icon";
import { cn } from "@integramind/ui/utils";
import { ColumnsIcon, FunctionSquareIcon, TableIcon } from "lucide-react";
import type { z } from "zod";

interface ReferenceBadgeProps {
  reference: z.infer<typeof rawContentReferenceElementSchema>;
  className?: string;
}

export function ReferenceBadge({ reference, className }: ReferenceBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border bg-accent px-1.5 py-0.5 text-xs text-accent-foreground",
        className,
      )}
    >
      {reference.referenceType === "database" ? (
        <PostgresIcon className="mr-1 size-3 text-primary" />
      ) : reference.referenceType === "input" ? (
        <>{renderDataTypeIcon(reference.dataType)}</>
      ) : reference.referenceType === "database-column" ? (
        <ColumnsIcon className="mr-1 size-3 text-primary" />
      ) : reference.referenceType === "database-table" ? (
        <TableIcon className="mr-1 size-3 text-primary" />
      ) : reference.referenceType === "utility-function" ? (
        <FunctionSquareIcon className="mr-1 size-3 text-primary" />
      ) : (
        <></>
      )}
      {reference.name}
    </div>
  );
}
