import type { NodeProps } from "reactflow";
import { memo, useState } from "react";
import Link from "next/link";
import {
  Brain,
  ExternalLink,
  FileText,
  PlayCircle,
  Trash,
  X,
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@integramind/ui/sheet";
import { cn } from "@integramind/ui/utils";

import type { SemanticBranchBlockData } from "~/types";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { useDevelopmentSheetStore } from "~/lib/store";

export const SemanticBranchBlock = memo(
  ({ data, isConnectable, selected }: NodeProps<SemanticBranchBlockData>) => {
    const [isDeleteAlertDialogOpen, setIsDeleteAlertDialogOpen] =
      useState<boolean>(false);
    const currentId = useDevelopmentSheetStore((state) => state.currentId);
    const updateCurrentId = useDevelopmentSheetStore(
      (state) => state.updateCurrentId,
    );
    const removeCurrentId = useDevelopmentSheetStore(
      (state) => state.removeCurrentId,
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
            <Sheet modal={false} open={currentId === data.id}>
              <SheetTrigger
                onClick={() => updateCurrentId(data.id)}
                className="cursor-grab"
              >
                <Card
                  className={cn(
                    "flex h-[78px] w-[256px] flex-col items-start gap-2 px-5 py-4",
                    {
                      "border-primary": selected,
                    },
                  )}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <Brain className="size-4 stroke-1 text-primary" />
                    <span className="text-muted-foreground">
                      Semantic Branch
                    </span>
                  </div>
                  <span className="text-sm">{data.name}</span>
                </Card>
              </SheetTrigger>
              <SheetContent className="right-2 top-16 flex h-[calc(100dvh-72px)] w-full flex-col gap-4 rounded-xl border bg-muted">
                <SheetHeader>
                  <SheetTitle className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="size-4 stroke-1 text-primary" />
                      <span>Semantic Branch</span>
                    </div>
                    <SheetClose onClick={() => removeCurrentId()}>
                      <Button variant="ghost" size="icon">
                        <X className="size-4" />
                        <span className="sr-only">Close</span>
                      </Button>
                    </SheetClose>
                  </SheetTitle>
                  <SheetDescription>
                    Develop your semantic branch here
                  </SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
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
