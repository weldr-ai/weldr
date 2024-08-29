import { Handle, Position, useReactFlow } from "@xyflow/react";
import {
  ExternalLinkIcon,
  FileTextIcon,
  PlayCircleIcon,
  RegexIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { memo, useState } from "react";

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
import {
  ExpandableCard,
  ExpandableCardContent,
  ExpandableCardHeader,
  ExpandableCardTrigger,
} from "@integramind/ui/expandable-card";
import { cn } from "@integramind/ui/utils";

import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode, FlowNodeProps } from "~/types";
import { PrimitiveDropdownMenu } from "./primitive-dropdown-menu";

export const Matcher = memo(
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

    const deleteMatcher = api.primitives.delete.useMutation();

    return (
      <div className="primitive">
        <ExpandableCard>
          <ExpandableCardTrigger>
            <ContextMenu>
              <ContextMenuTrigger>
                <Card
                  className={cn(
                    "drag-handle flex h-[84px] w-[256px] cursor-grab flex-col items-start gap-2 bg-muted px-5 py-4",
                    {
                      "border-primary": selected,
                    },
                  )}
                  onClick={() => {
                    reactFlow.fitBounds(
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
                  <div className="flex items-center gap-2 text-xs">
                    <RegexIcon className="size-4 text-primary" />
                    <span className="text-muted-foreground">Matcher</span>
                  </div>
                  <span className="text-sm">{data.name}</span>
                </Card>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuLabel className="text-xs">Matcher</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem className="text-xs">
                  <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
                  Run with previous primitives
                </ContextMenuItem>
                <ContextMenuItem className="flex items-center justify-between text-xs">
                  <Link
                    className="flex items-center"
                    href="https://docs.integramind.ai/primitives/matcher"
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
          </ExpandableCardTrigger>
          <ExpandableCardContent className="nowheel flex h-[400px] flex-col p-0">
            <ExpandableCardHeader className="flex flex-col items-start justify-start px-6 py-4">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <RegexIcon className="size-4 text-primary" />
                  <span className="text-muted-foreground">Matcher</span>
                </div>
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
                    label="Matcher"
                    docsUrlPath="matcher"
                  />
                </div>
              </div>
              <span className="text-sm">{data.name}</span>
            </ExpandableCardHeader>
          </ExpandableCardContent>
        </ExpandableCard>
        <Handle
          className="border rounded-full bg-background p-1"
          type="target"
          position={Position.Left}
        />
        <Handle
          className="border rounded-full bg-background p-1"
          type="source"
          position={Position.Right}
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
            deleteMatcher.mutate({
              id: data.id,
            });
          }}
        />
      </div>
    );
  },
);

Matcher.displayName = "Matcher";
