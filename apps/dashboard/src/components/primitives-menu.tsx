import React, { useState } from "react";
import {
  CornerDownLeft,
  PanelRightClose,
  PanelRightOpen,
  Repeat,
  Split,
} from "lucide-react";

import { Button } from "@integramind/ui/button";
import { Card } from "@integramind/ui/card";

import type { PrimitiveType } from "~/types";
import { LambdaIcon } from "~/components/icons/lambda-icon";

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
        <Card className="flex flex-col space-y-2 bg-muted px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Primitives</span>
            <Button
              className="size-6 rounded-sm bg-muted"
              variant="outline"
              size="icon"
              onClick={() => setIsVisible(false)}
            >
              <PanelRightClose className="size-3 text-muted-foreground" />
            </Button>
          </div>
          <div className="grid w-full grid-cols-2 gap-2">
            <div
              className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab"
              onDragStart={(event) => onDragStart(event, "function")}
              draggable
            >
              <LambdaIcon className="size-4 stroke-primary" />
              <span className="w-full text-[10px]">Function</span>
            </div>
            <div
              className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab"
              onDragStart={(event) => onDragStart(event, "conditional-branch")}
              draggable
            >
              <Split className="size-4 text-primary" />
              <span className="w-full text-[10px]">Conditional Branch</span>
            </div>
            <div
              className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab"
              onDragStart={(event) => onDragStart(event, "loop")}
              draggable
            >
              <Repeat className="size-4 text-primary" />
              <span className="w-full text-[10px]">Loop</span>
            </div>
            <div
              className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab"
              onDragStart={(event) => onDragStart(event, "response")}
              draggable
            >
              <CornerDownLeft className="size-4 text-primary" />
              <span className="w-full text-[10px]">Response</span>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          className="bg-muted hover:bg-accent"
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(true)}
        >
          <PanelRightOpen className="mr-2 size-3.5 text-muted-foreground" />
          Show primitives menu
        </Button>
      )}
    </>
  );
}
