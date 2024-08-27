import {
  Handle,
  NodeResizeControl,
  Position,
  useReactFlow,
} from "@xyflow/react";
import {
  ExternalLinkIcon,
  FileTextIcon,
  PlayCircleIcon,
  RepeatIcon,
  TrashIcon,
} from "lucide-react";
import { memo, useState } from "react";

import { Card } from "@integramind/ui/card";
import { cn } from "@integramind/ui/utils";

import { Button } from "@integramind/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@integramind/ui/context-menu";
import {
  ExpandableCard,
  ExpandableCardContent,
  ExpandableCardHeader,
  ExpandableCardTrigger,
} from "@integramind/ui/expandable-card";
import Link from "next/link";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode, FlowNodeProps } from "~/types";
import { PrimitiveDropdownMenu } from "./primitive-dropdown-menu";

export const Iterator = memo(
  ({
    data,
    isConnectable,
    positionAbsoluteX,
    positionAbsoluteY,
    selected,
  }: FlowNodeProps) => {
    const reactFlow = useReactFlow<FlowNode, FlowEdge>();
    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);

    const deleteIterator = api.primitives.delete.useMutation();

    return (
      <>
        <ContextMenu>
          <ContextMenuTrigger>
            <Card
              className={cn(
                "drag-handle flex size-full min-h-[400px] min-w-[600px] bg-background cursor-grab flex-col items-start gap-2",
                {
                  "border-primary": selected,
                },
              )}
            >
              <ExpandableCard className="w-full">
                <div className="flex w-full px-2 py-2 bg-muted rounded-t-xl border-b items-center justify-between">
                  <ExpandableCardTrigger className="flex flex-col hover:bg-accent px-3 py-2 rounded-md">
                    <div className="flex items-center gap-2 text-xs">
                      <RepeatIcon className="size-4 text-primary" />
                      <span className="text-muted-foreground">Iterator</span>
                    </div>
                    <span className="text-sm">
                      {data.name ?? "new_iterator"}
                    </span>
                  </ExpandableCardTrigger>
                  <div className="flex items-center">
                    <Button
                      className="size-7 text-success hover:text-success"
                      variant="ghost"
                      size="icon"
                    >
                      <PlayCircleIcon className="size-3.5" />
                    </Button>
                    <PrimitiveDropdownMenu
                      setDeleteAlertDialogOpen={setDeleteAlertDialogOpen}
                      label="Iterator"
                      docsUrlPath="iterator"
                    />
                  </div>
                </div>
                <ExpandableCardContent className="nowheel flex h-[400px] w-[400px] left-0 flex-col p-0">
                  <ExpandableCardHeader className="flex flex-col items-start justify-start px-6 py-4">
                    <div className="flex items-center gap-2 text-xs">
                      <RepeatIcon className="size-4 text-primary" />
                      <span className="text-muted-foreground">Iterator</span>
                    </div>
                    <span className="text-sm">
                      {data.name ?? "new_iterator"}
                    </span>
                  </ExpandableCardHeader>
                </ExpandableCardContent>
              </ExpandableCard>
            </Card>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel className="text-xs">Iterator</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-xs">
              <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
              Run with previous primitives
            </ContextMenuItem>
            <ContextMenuItem className="flex items-center justify-between text-xs">
              <Link
                className="flex items-center"
                href="https://docs.integramind.ai/primitives/iterator"
                target="blank"
              >
                <FileTextIcon className="mr-3 size-4 text-muted-foreground" />
                Docs
              </Link>
              <ExternalLinkIcon className="size-3 text-muted-foreground" />
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="flex text-xs text-destructive hover:text-destructive focus:text-destructive/90"
              onClick={() => setDeleteAlertDialogOpen(true)}
            >
              <TrashIcon className="mr-3 size-4" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <NodeResizeControl
          position="bottom-right"
          className="p-[1px] border-none bg-primary rounded-full"
          minWidth={256}
          minHeight={84}
        />
        <Handle
          className="border rounded-full bg-background p-1"
          type="target"
          position={Position.Top}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
        <Handle
          className="border rounded-full bg-background p-1"
          type="source"
          position={Position.Bottom}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
        <DeleteAlertDialog
          open={deleteAlertDialogOpen}
          setOpen={setDeleteAlertDialogOpen}
          onDelete={() => {
            reactFlow.deleteElements({
              nodes: [
                {
                  id: data.id,
                },
              ],
            });
            deleteIterator.mutate({
              id: data.id,
            });
          }}
        />
      </>
    );
  },
);

Iterator.displayName = "Iterator";
