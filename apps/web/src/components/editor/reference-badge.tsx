import type { referencePartSchema } from "@weldr/shared/validators/chats";
import { cn } from "@weldr/ui/lib/utils";
import {
  AppWindowIcon,
  ComponentIcon,
  FunctionSquareIcon,
  TableIcon,
} from "lucide-react";
import type { z } from "zod";

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
      {reference.type === "reference:function" ? (
        <FunctionSquareIcon className="mr-1 size-3 text-primary" />
      ) : reference.type === "reference:model" ? (
        <TableIcon className="mr-1 size-3 text-primary" />
      ) : reference.type === "reference:component" ? (
        <>
          {reference.subtype === "page" ? (
            <AppWindowIcon className="mr-1 size-3 text-primary" />
          ) : reference.subtype === "reusable" ? (
            <ComponentIcon className="mr-1 size-3 text-primary" />
          ) : (
            <></>
          )}
        </>
      ) : reference.type === "reference:endpoint" ? (
        <span className="mr-1 text-primary text-xs">REST</span>
      ) : (
        <></>
      )}
      {reference.name}
    </span>
  );
}
