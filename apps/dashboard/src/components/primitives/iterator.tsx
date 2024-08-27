import {
  Handle,
  NodeResizeControl,
  Position,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import { memo, useState } from "react";

import { Card } from "@integramind/ui/card";
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
import { cn } from "@integramind/ui/utils";
import {
  ChevronRightIcon,
  CircleMinus,
  ExternalLinkIcon,
  FileTextIcon,
  PlayCircleIcon,
  RepeatIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode, FlowNodeProps } from "~/types";

export const Iterator = memo(
  ({
    data,
    isConnectable,
    positionAbsoluteX,
    positionAbsoluteY,
    selected,
    parentId,
  }: FlowNodeProps) => {
    const { fitBounds, setNodes, deleteElements } = useReactFlow<
      FlowNode,
      FlowEdge
    >();
    const nodes = useNodes<FlowNode>();

    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);

    const deleteIterator = api.primitives.delete.useMutation();

    return (
      <>
        <div className="size-full relative">
          <ExpandableCard className="absolute top-[-42px] left-[50px]">
            <ContextMenu>
              <ContextMenuTrigger>
                <ExpandableCardTrigger>
                  <Card
                    className={cn(
                      "drag-handle flex h-[84px] w-[256px] cursor-grab flex-col items-start gap-2 px-5 py-4 dark:bg-muted",
                      {
                        "border-primary": selected,
                      },
                    )}
                    onClick={() => {
                      fitBounds(
                        {
                          x: positionAbsoluteX,
                          y: positionAbsoluteY,
                          width: 400,
                          height: 400 + 300,
                        },
                        {
                          duration: 500,
                        },
                      );
                    }}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <RepeatIcon className="size-4 text-primary" />
                        <span className="text-muted-foreground">Iterator</span>
                      </div>
                    </div>
                    <span className="text-sm">
                      {data.name ?? "new_iterator"}
                    </span>
                  </Card>
                </ExpandableCardTrigger>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuLabel className="text-xs">
                  Iterator
                </ContextMenuLabel>
                <ContextMenuSeparator />
                {parentId && (
                  <ContextMenuItem
                    className="text-xs"
                    onClick={() => {
                      const parent = nodes.find((node) => node.id === parentId);
                      if (parent) {
                        setNodes(
                          nodes.map((node) => {
                            if (node.id === data.id) {
                              return {
                                ...node,
                                parentId: undefined,
                                extent: undefined,
                                expandParent: undefined,
                                position: {
                                  x:
                                    parent.position.x +
                                    (parent.measured?.width ?? 0) / 2 -
                                    150,
                                  y: parent.position.y - 100,
                                },
                              };
                            }
                            return node;
                          }),
                        );
                      }
                    }}
                  >
                    <CircleMinus className="mr-3 size-4 text-muted-foreground" />
                    Detach
                  </ContextMenuItem>
                )}
                <ContextMenuItem className="text-xs">
                  <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
                  Run with previous primitives
                </ContextMenuItem>
                <ContextMenuItem className="flex items-center justify-between text-xs">
                  <Link
                    className="flex items-center"
                    href="https://docs.integramind.ai/primitives/function"
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
            <ExpandableCardContent className="nowheel flex h-[600px] w-[800px] flex-col p-0">
              <div className="flex size-full flex-col">
                <ExpandableCardHeader className="flex flex-col items-start justify-start">
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <RepeatIcon className="size-4 text-primary" />
                      <span className="text-muted-foreground">Iterator</span>
                    </div>
                  </div>
                </ExpandableCardHeader>
              </div>
            </ExpandableCardContent>
          </ExpandableCard>
          <div className="absolute p-1 top-[-12px] left-[306px] bg-background">
            <ChevronRightIcon className="text-primary size-4" />
          </div>
          <div className="z-[-9999] size-full min-w-[600px] min-h-[400px] border rounded-xl" />
        </div>
        <NodeResizeControl
          className="bg-primary border-none p-[2px] rounded-full"
          position="bottom-right"
          minWidth={600}
          minHeight={400}
        />
        <Handle
          className="border rounded-full bg-background p-1"
          type="target"
          position={Position.Left}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
        <Handle
          className="border rounded-full bg-background p-1"
          type="source"
          position={Position.Right}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
        <DeleteAlertDialog
          open={deleteAlertDialogOpen}
          setOpen={setDeleteAlertDialogOpen}
          onDelete={() => {
            deleteElements({
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
