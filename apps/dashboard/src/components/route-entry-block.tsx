"use client";

import type { NodeProps } from "reactflow";
import { memo } from "react";
import { Handle, Position } from "reactflow";

import { Badge } from "@integramind/ui/badge";
import { Card } from "@integramind/ui/card";

export interface RouteEntryBlockProps extends NodeProps {
  data: {
    id: string;
    name: string;
  };
  isConnectable: boolean;
}

export const RouteEntryBlock = memo(
  ({ data, isConnectable }: RouteEntryBlockProps) => {
    return (
      <>
        <Card className="flex h-[84px] w-[256px] flex-col gap-2 px-5 py-4">
          <div className="flex w-full items-center gap-2 text-xs">
            <Badge variant="default" className="text-xs">
              POST
            </Badge>
            <span className="text-muted-foreground">API Route</span>
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

RouteEntryBlock.displayName = "RouteEntryBlock";
