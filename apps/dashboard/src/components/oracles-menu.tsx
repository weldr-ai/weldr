import React, { useState } from "react";
import {
  Bot,
  Brain,
  CornerDownLeft,
  Cpu,
  Database,
  PanelRightClose,
  PanelRightOpen,
  Split,
} from "lucide-react";

import { Button } from "@integramind/ui/button";
import { Card } from "@integramind/ui/card";

export function OraclesMenu() {
  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    nodeType: string,
  ) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };
  const [isVisible, setIsVisible] = useState<boolean>(true);

  return (
    <>
      {isVisible ? (
        <Card className="flex w-80 border-none bg-muted px-6 py-4 shadow-sm">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Actions</span>
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
                  onDragStart={(event) =>
                    onDragStart(event, "query-resource-node")
                  }
                  draggable
                >
                  <Database className="size-4" />
                  <span className="w-full text-[10px]">Query Resource</span>
                </div>
                <div
                  className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab"
                  onDragStart={(event) =>
                    onDragStart(event, "logical-processing-node")
                  }
                  draggable
                >
                  <Cpu className="size-4" />
                  <span className="w-full text-[10px]">Logical Processing</span>
                </div>
                <div
                  className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab"
                  onDragStart={(event) =>
                    onDragStart(event, "ai-processing-node")
                  }
                  draggable
                >
                  <Bot className="size-4" />
                  <span className="w-full text-[10px]">AI Processing</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Controls</span>
              <div className="grid w-full grid-cols-2 gap-2">
                <div
                  className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab"
                  onDragStart={(event) =>
                    onDragStart(event, "logical-branch-node")
                  }
                  draggable
                >
                  <Split className="size-4" />
                  <span className="w-full text-[10px]">Logical Branch</span>
                </div>
                <div
                  className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab"
                  onDragStart={(event) =>
                    onDragStart(event, "semantic-branch-node")
                  }
                  draggable
                >
                  <Brain className="size-4" />
                  <span className="w-full text-[10px]">Semantic Branch</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Responses</span>
              <div className="grid w-full grid-cols-2 gap-2">
                <div
                  className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab"
                  onDragStart={(event) => onDragStart(event, "response-node")}
                  draggable
                >
                  <CornerDownLeft className="size-4" />
                  <span className="w-full text-[10px]">Response</span>
                </div>
              </div>
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
          Show oracles menu
        </Button>
      )}
    </>
  );
}
