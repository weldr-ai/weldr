import { AppWindowIcon, TableIcon } from "lucide-react";
import type { z } from "zod";

import type { referencePartSchema } from "@weldr/shared/validators/chats";
import { cn } from "@weldr/ui/lib/utils";

interface ReferenceBadgeProps {
  reference: z.infer<typeof referencePartSchema>;
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
      {reference.type === "db-model" ? (
        <TableIcon className="mr-1 size-3 text-primary" />
      ) : reference.type === "page" ? (
        <AppWindowIcon className="mr-1 size-3 text-primary" />
      ) : reference.type === "endpoint" ? (
        <span className="mr-1 text-primary text-xs">{reference.method}</span>
      ) : null}
      {reference.type === "endpoint" ? reference.path : reference.name}
    </span>
  );
}
