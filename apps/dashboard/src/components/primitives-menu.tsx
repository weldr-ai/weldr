import {
  CornerDownLeftIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  RepeatIcon,
  SplitIcon,
} from "lucide-react";
import type React from "react";
import { useState } from "react";

import { Button } from "@integramind/ui/button";
import { Card } from "@integramind/ui/card";

import { LambdaIcon } from "~/components/icons/lambda-icon";
import type { PrimitiveType } from "~/types";

export function PrimitivesMenu() {
  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    primitiveTypes: PrimitiveType,
  ) => {
    event.dataTransfer.setData("application/reactflow", primitiveTypes);
    event.dataTransfer.effectAllowed = "move";
  };
  const [isVisible, setIsVisible] = useState<boolean>(true);

  return (
    <>
      {isVisible ? (
        <Card className="flex flex-col space-y-2 bg-background px-6 py-4 shadow-sm dark:bg-muted">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground dark:text-muted-foreground">
              Primitives
            </span>
            <Button
              className="size-6 rounded-sm dark:bg-muted"
              variant="outline"
              size="icon"
              onClick={() => setIsVisible(false)}
            >
              <PanelRightCloseIcon className="size-3 text-muted-foreground" />
            </Button>
          </div>
          <div className="grid w-full grid-cols-2 gap-2">
            <div
              className="flex w-full items-center justify-center gap-2 rounded-lg border p-2 text-accent-foreground hover:cursor-grab dark:bg-accent"
              onDragStart={(event) => onDragStart(event, "function")}
              draggable
            >
              <LambdaIcon className="size-4 stroke-primary" />
              <span className="w-full text-[10px]">Function</span>
            </div>
            <div
              className="flex w-full items-center justify-center gap-2 rounded-lg border p-2 text-accent-foreground hover:cursor-grab dark:bg-accent"
              onDragStart={(event) => onDragStart(event, "conditional-branch")}
              draggable
            >
              <SplitIcon className="size-4 text-primary" />
              <span className="w-full text-[10px]">Conditional Branch</span>
            </div>
            <div
              className="flex w-full items-center justify-center gap-2 rounded-lg border p-2 text-accent-foreground hover:cursor-grab dark:bg-accent"
              onDragStart={(event) => onDragStart(event, "iterator")}
              draggable
            >
              <RepeatIcon className="size-4 text-primary" />
              <span className="w-full text-[10px]">Iterator</span>
            </div>
            <div
              className="flex w-full items-center justify-center gap-2 rounded-lg border p-2 text-accent-foreground hover:cursor-grab dark:bg-accent"
              onDragStart={(event) => onDragStart(event, "response")}
              draggable
            >
              <CornerDownLeftIcon className="size-4 text-primary" />
              <span className="w-full text-[10px]">Response</span>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          className="bg-background hover:bg-accent dark:bg-muted"
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(true)}
        >
          <PanelRightOpenIcon className="mr-2 size-3.5 text-muted-foreground" />
          Show primitives menu
        </Button>
      )}
    </>
  );
}
