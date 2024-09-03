import { memo } from "react";

import { Card } from "@integramind/ui/card";
import { Handle, Position } from "@xyflow/react";

export const IteratorOutput = memo(() => {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="border rounded-full bg-background p-1"
      />
      <Card className="flex h-[32px] w-[64px] items-center justify-center dark:bg-muted rounded-md">
        <div className="text-xs">Output</div>
      </Card>
    </>
  );
});

IteratorOutput.displayName = "IteratorOutput";
