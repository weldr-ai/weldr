import type { NodeProps } from "reactflow";
import React, { memo, useState } from "react";
import Link from "next/link";
import { Cpu, ExternalLink, FileText, PlayCircle, Trash } from "lucide-react";
import { Handle, Position } from "reactflow";

import { Card } from "@integramind/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@integramind/ui/context-menu";

import { DeleteAlertDialog } from "~/components/delete-alert-dialog";

interface LogicalProcessingBlockProps extends NodeProps {
  data: {
    id: string;
    name: string;
    description?: string;
  };
  isConnectable: boolean;
}

export const LogicalProcessingBlock = memo(
  ({ data, isConnectable }: LogicalProcessingBlockProps) => {
    const [isDeleteAlertDialogOpen, setIsDeleteAlertDialogOpen] =
      useState<boolean>(false);

    return (
      <>
        <Handle
          className="border-border bg-background p-1"
          type="source"
          position={Position.Left}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
        <ContextMenu>
          <ContextMenuTrigger>
            <Card className="flex h-[84px] w-[256px] flex-col gap-2 px-5 py-4">
              <div className="flex w-full items-center gap-2 text-xs">
                <Cpu className="size-4 stroke-1 text-primary" />
                <span className="text-muted-foreground">
                  Logical Processing
                </span>
              </div>
              <span className="text-sm">{data.name}</span>
            </Card>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel className="text-xs">
              Logical Processing
            </ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-xs">
              <PlayCircle className="mr-3 size-4 text-muted-foreground" />
              Run with previous blocks
            </ContextMenuItem>
            <ContextMenuItem className="flex items-center justify-between text-xs">
              <Link
                className="flex items-center"
                href="https://docs.integramind.ai/blocks/query"
                target="blank"
              >
                <FileText className="mr-3 size-4 text-muted-foreground" />
                Docs
              </Link>
              <ExternalLink className="size-3 text-muted-foreground" />
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="flex text-xs text-destructive hover:text-destructive focus:text-destructive/90"
              onClick={() => setIsDeleteAlertDialogOpen(true)}
            >
              <Trash className="mr-3 size-4" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <DeleteAlertDialog
          open={isDeleteAlertDialogOpen}
          onOpenChange={setIsDeleteAlertDialogOpen}
        />
        <Handle
          className="border-border bg-background p-1"
          type="target"
          position={Position.Right}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
      </>
    );
  },
);

LogicalProcessingBlock.displayName = "LogicalProcessingBlock";
