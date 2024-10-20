import type { DataType } from "@specly/shared/types";
import { renderDataTypeIcon } from "@specly/shared/utils";
import { PostgresIcon } from "@specly/ui/icons/postgres-icon";
import { cn } from "@specly/ui/utils";
import { ColumnsIcon, TableIcon } from "lucide-react";

export function ReferenceBadge({
  referenceType,
  dataType,
  name,
  className,
}: {
  referenceType: "input" | "database" | "database-table" | "database-column";
  dataType: DataType;
  name: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border bg-accent px-1.5 py-0.5 text-xs text-accent-foreground",
        className,
      )}
    >
      {referenceType === "database" ? (
        <PostgresIcon className="mr-1 size-3 text-primary" />
      ) : referenceType === "input" ? (
        <>{renderDataTypeIcon(dataType)}</>
      ) : referenceType === "database-column" ? (
        <ColumnsIcon className="mr-1 size-3 text-primary" />
      ) : referenceType === "database-table" ? (
        <TableIcon className="mr-1 size-3 text-primary" />
      ) : (
        <></>
      )}
      {name}
    </div>
  );
}
