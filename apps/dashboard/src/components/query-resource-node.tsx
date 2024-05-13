"use client";

import type { NodeProps } from "reactflow";
import type { Descendant } from "slate";
import React, { memo, useState } from "react";
import { Database, MoreHorizontal, PanelRight, Play } from "lucide-react";
import { Handle, NodeResizer, Position } from "reactflow";

import { Button } from "@integramind/ui/button";
import { Card } from "@integramind/ui/card";
import { Input } from "@integramind/ui/input";

import { TextHighlighter } from "./TextHighlighter";

interface QueryResourceNodeProps extends NodeProps {
  data: {
    id: string;
    description?: string;
  };
  isConnectable: boolean;
}

export const QueryResourceNode = memo(
  ({ data, isConnectable }: QueryResourceNodeProps) => {
    const [text, setText] = useState<Descendant[]>([
      {
        children: [
          {
            text: "Get the name and department of all employees from @DB1 based on >age where age is higher than or equal to 30.",
          },
        ],
      },
    ]);

    return (
      <>
        <NodeResizer
          minWidth={384}
          minHeight={192}
          lineClassName="border-none"
          handleClassName="border-none bg-transparent"
        />
        <Handle
          type="target"
          className="top-7 border-border bg-background p-1"
          position={Position.Left}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
        <Card className="flex h-full min-h-48 w-full min-w-96 flex-col gap-2 p-3">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-primary" />
              <Input
                className="h-fit w-full border-none bg-transparent px-2 text-xs font-semibold hover:cursor-text hover:bg-accent focus:bg-background"
                defaultValue={data.id}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button className="size-6" variant="ghost" size="icon">
                <Play className="size-3 text-success" />
              </Button>
              <Button className="size-6" variant="ghost" size="icon">
                <PanelRight className="size-3" />
              </Button>
              <Button className="size-6" variant="ghost" size="icon">
                <MoreHorizontal className="size-3" />
              </Button>
            </div>
          </div>
          <TextHighlighter value={text} onValueChange={setText} />
        </Card>
        <Handle
          type="source"
          className="top-7 border-border bg-background p-1"
          position={Position.Right}
          isConnectable={isConnectable}
        />
      </>
    );
  },
);

QueryResourceNode.displayName = "QueryResourceNode";
