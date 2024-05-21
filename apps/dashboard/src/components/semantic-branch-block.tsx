import type { NodeProps } from "reactflow";
import { memo, useState } from "react";
import Link from "next/link";
import {
  Brain,
  ExternalLink,
  FileText,
  PanelLeft,
  PlayCircle,
  Trash,
} from "lucide-react";
import { Handle, Position } from "reactflow";

import { Button } from "@integramind/ui/button";
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

interface SemanticBranchBlockProps extends NodeProps {
  data: {
    id: string;
    name: string;
    description?: string;
  };
  isConnectable: boolean;
}

export const SemanticBranchBlock = memo(
  ({ data, isConnectable }: SemanticBranchBlockProps) => {
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
            <Card className="flex h-[86px] w-[256px] flex-col gap-2 px-5 py-4">
              <div className="flex w-full items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Brain className="size-4 stroke-1 text-primary" />
                  <span className="text-muted-foreground">Semantic Branch</span>
                </div>
                <Button className="size-6" variant="ghost" size="icon">
                  <PanelLeft className="size-3 text-muted-foreground" />
                </Button>
              </div>
              <span className="text-sm">{data.name}</span>
            </Card>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel className="text-xs">
              Semantic Branch
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

SemanticBranchBlock.displayName = "SemanticBranchBlock";
