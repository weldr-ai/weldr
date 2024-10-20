import { CornerDownLeftIcon, RegexIcon, RepeatIcon } from "lucide-react";
import type React from "react";

import type { PrimitiveType } from "@specly/shared/types";
import { LambdaIcon } from "@specly/ui/icons/lambda-icon";

import { Tooltip, TooltipContent, TooltipTrigger } from "@specly/ui/tooltip";

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
            <LambdaIcon className="size-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-muted border">
          <p>Function</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="inline-flex items-center justify-center size-9 rounded-full hover:bg-accent hover:text-accent-foreground hover:cursor-grab"
            // onDragStart={(event) => onDragStart(event, "iterator")}
            draggable
          >
            <RepeatIcon className="size-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-muted border">
          <p>Iterator</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="inline-flex items-center justify-center size-9 rounded-full hover:bg-accent hover:text-accent-foreground hover:cursor-grab"
            // onDragStart={(event) => onDragStart(event, "matcher")}
            draggable
          >
            <RegexIcon className="size-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-muted border">
          <p>Matcher</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="inline-flex items-center justify-center size-9 rounded-full hover:bg-accent hover:text-accent-foreground hover:cursor-grab"
            onDragStart={(event) => onDragStart(event, "response")}
            draggable
          >
            <CornerDownLeftIcon className="size-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-muted border">
          <p>Response</p>
        </TooltipContent>
      </Tooltip>
    </>
  );
}
