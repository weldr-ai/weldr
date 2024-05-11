import React from "react";
import { Bot, Brain, CornerDownLeft, Cpu, Database, Split } from "lucide-react";

import { Separator } from "@integramind/ui/separator";

export function AddOracle() {
  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    nodeType: string,
  ) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 p-4">
        <div
          className="flex h-28 flex-col items-center justify-center gap-3"
          onDragStart={(event) => onDragStart(event, "query-resource-node")}
          draggable
        >
          <div className="flex size-16 items-center justify-center rounded-lg bg-accent hover:scale-105 hover:cursor-grab">
            <Database />
          </div>
          <span className=" h-6 text-center text-xs font-medium">
            Query Resource
          </span>
        </div>
        <div
          className="flex h-28 flex-col items-center justify-center gap-3"
          onDragStart={(event) =>
            onDragStart(event, "logical-data-processing-node")
          }
          draggable
        >
          <div className="flex size-16 items-center justify-center rounded-lg bg-accent hover:scale-105 hover:cursor-grab">
            <Cpu />
          </div>
          <span className="h-6 text-center text-xs font-medium">
            Logical Data Processing
          </span>
        </div>
        <div
          className="flex h-28 flex-col items-center justify-center gap-3"
          onDragStart={(event) => onDragStart(event, "ai-data-processing-node")}
          draggable
        >
          <div className="flex size-16 items-center justify-center rounded-lg bg-accent hover:scale-105 hover:cursor-grab">
            <Bot />
          </div>
          <span className="h-6 text-center text-xs font-medium">
            AI Data Processing
          </span>
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-2 p-4">
        <div
          className="flex h-28 flex-col items-center justify-center gap-3"
          onDragStart={(event) => onDragStart(event, "logical-branch-node")}
          draggable
        >
          <div className="flex size-16 items-center justify-center rounded-lg bg-accent hover:scale-105 hover:cursor-grab">
            <Split />
          </div>
          <span className="h-6 text-center text-xs font-medium">
            Logical Branch
          </span>
        </div>
        <div
          className="flex h-28 flex-col items-center justify-center gap-3"
          onDragStart={(event) => onDragStart(event, "semantic-branch-node")}
          draggable
        >
          <div className="flex size-16 items-center justify-center rounded-lg bg-accent hover:scale-105 hover:cursor-grab">
            <Brain />
          </div>
          <span className="h-6 text-center text-xs font-medium">
            Semantic Branch
          </span>
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-2 p-4">
        <div
          className="flex h-28 flex-col items-center justify-center gap-3"
          onDragStart={(event) => onDragStart(event, "response-node")}
          draggable
        >
          <div className="flex size-16 items-center justify-center rounded-lg bg-accent hover:scale-105 hover:cursor-grab">
            <CornerDownLeft />
          </div>
          <span className="h-6 text-center text-xs font-medium">Response</span>
        </div>
      </div>
    </div>
  );
}
