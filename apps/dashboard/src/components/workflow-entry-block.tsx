"use client";

import type { NodeProps } from "reactflow";
import { memo } from "react";
import { PanelLeft } from "lucide-react";
import { Handle, Position } from "reactflow";

import { Badge } from "@integramind/ui/badge";
import { Button } from "@integramind/ui/button";
import { Card } from "@integramind/ui/card";

interface WorkflowEntryBlockProps extends NodeProps {
  data: {
    id: string;
    name: string;
  };
  isConnectable: boolean;
}

export const WorkflowEntryBlock = memo(
  ({ data, isConnectable }: WorkflowEntryBlockProps) => {
    return (
      <>
        <Card className="flex h-[86px] w-[256px] flex-col gap-2 px-5 py-4">
          <div className="flex w-full items-center justify-between text-xs">
            <div className="flex w-full items-center gap-2">
              <Badge variant="default" className="text-xs">
                Event
              </Badge>
              <span className="text-muted-foreground">Workflow</span>
            </div>
            <Button className="size-6" variant="ghost" size="icon">
              <PanelLeft className="size-3 text-muted-foreground" />
            </Button>
          </div>
          <span className="text-sm">{data.name}</span>
        </Card>
        <Handle
          type="target"
          className="border-border bg-background p-1"
          position={Position.Right}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
      </>
    );
  },
);

WorkflowEntryBlock.displayName = "WorkflowEntryBlock";
