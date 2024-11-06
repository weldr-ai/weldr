import { cn } from "@specly/ui/utils";
import { Handle, Position } from "@xyflow/react";
import { CornerDownLeftIcon } from "lucide-react";
import { memo } from "react";

import type { FlowNodeProps } from "~/types";

export const Stop = memo(({ data: _data, selected }: FlowNodeProps) => {
  return (
    <>
      <div
        className={cn(
          "flex items-center justify-center size-10 rounded-full bg-muted border drag-handle hover:shadow-lg hover:shadow-black",
          selected && "border-primary",
        )}
      >
        <CornerDownLeftIcon className="size-4" />
      </div>
      <Handle
        className="border rounded-full bg-background p-1"
        type="target"
        position={Position.Left}
      />
    </>
  );
});

Stop.displayName = "Stop";
