import { CornerDownLeftIcon, RegexIcon, RepeatIcon } from "lucide-react";
import type React from "react";

import type { PrimitiveType } from "@integramind/shared/types";
import { LambdaIcon } from "@integramind/ui/icons/lambda-icon";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@integramind/ui/tooltip";

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
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger>
            <div
              className="inline-flex items-center justify-center h-9 w-11 rounded-full hover:bg-accent hover:text-accent-foreground hover:cursor-grab"
              onDragStart={(event) => onDragStart(event, "function")}
              draggable
            >
              <LambdaIcon className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-muted">
            <p>Function</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger>
            <div
              className="inline-flex items-center justify-center h-9 w-11 rounded-full hover:bg-accent hover:text-accent-foreground hover:cursor-grab"
              onDragStart={(event) => onDragStart(event, "iterator")}
              draggable
            >
              <RepeatIcon className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-muted">
            <p>Iterator</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger>
            <div
              className="inline-flex items-center justify-center h-9 w-11 rounded-full hover:bg-accent hover:text-accent-foreground hover:cursor-grab"
              onDragStart={(event) => onDragStart(event, "matcher")}
              draggable
            >
              <RegexIcon className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-muted">
            <p>Matcher</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger>
            <div
              className="inline-flex items-center justify-center h-9 w-11 rounded-full hover:bg-accent hover:text-accent-foreground hover:cursor-grab"
              onDragStart={(event) => onDragStart(event, "response")}
              draggable
            >
              <CornerDownLeftIcon className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-muted">
            <p>Response</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}
