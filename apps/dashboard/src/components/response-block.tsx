import type { NodeProps } from "reactflow";
import { memo, useState } from "react";
import Link from "next/link";
import {
  CornerDownLeft,
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

import type { ResponseBlockData } from "~/types";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { useDevelopmentBarStore } from "~/lib/store";

export const ResponseBlock = memo(
  ({ data, isConnectable }: NodeProps<ResponseBlockData>) => {
    const [isDeleteAlertDialogOpen, setIsDeleteAlertDialogOpen] =
      useState<boolean>(false);
    const updateActiveBlock = useDevelopmentBarStore(
      (state) => state.updateActiveBlock,
    );

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
                  <CornerDownLeft className="size-4 stroke-1 text-primary" />
                  <span className="text-muted-foreground">Response</span>
                </div>
                <Button
                  className="size-6"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    updateActiveBlock({
                      type: "response-block",
                      data,
                    })
                  }
                >
                  <PanelLeft className="size-3 text-muted-foreground" />
                </Button>
              </div>
              <span className="text-sm">{data.name}</span>
            </Card>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel className="text-xs">Response</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-xs">
              <PlayCircle className="mr-3 size-4 text-muted-foreground" />
              Run with previous blocks
            </ContextMenuItem>
            <ContextMenuItem className="flex items-center justify-between text-xs">
              <Link
                className="flex items-center"
                href="https://docs.integramind.ai/blocks/response"
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

ResponseBlock.displayName = "ResponseBlock";
