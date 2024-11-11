import type React from "react";

import type { PrimitiveType } from "@integramind/shared/types";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import { FunctionSquareIcon } from "lucide-react";

export function PrimitivesMenu() {
  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    primitiveTypes: PrimitiveType,
  ) => {
    event.dataTransfer.setData("application/reactflow", primitiveTypes);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="inline-flex items-center justify-center size-9 rounded-full hover:bg-accent hover:text-accent-foreground hover:cursor-grab"
            onDragStart={(event) => onDragStart(event, "function")}
            draggable
          >
            <FunctionSquareIcon className="size-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-muted border">
          <p>Function</p>
        </TooltipContent>
      </Tooltip>
    </>
  );
}
