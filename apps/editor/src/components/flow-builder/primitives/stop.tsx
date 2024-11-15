import { cn } from "@integramind/ui/utils";
import { Handle, Position, useConnection } from "@xyflow/react";
import { CornerDownLeftIcon } from "lucide-react";
import { memo } from "react";

import type { FlowNodeProps } from "~/types";

export const Stop = memo(({ data, selected }: FlowNodeProps) => {
  const connection = useConnection();
  const isTarget = connection.inProgress;

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-center size-10 rounded-full bg-muted border drag-handle hover:shadow-lg hover:shadow-black",
          {
            "border-primary": selected,
            "bg-primary/40": isTarget,
          },
        )}
      >
        <CornerDownLeftIcon className="size-4" />
      </div>
      <Handle
        className="bg-transparent"
        type="target"
        position={Position.Left}
        isConnectableStart={false}
      />
    </>
  );
});

Stop.displayName = "Stop";
