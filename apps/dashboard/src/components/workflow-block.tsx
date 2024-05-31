"use client";

import type { NodeProps } from "reactflow";
import { memo } from "react";
import { X } from "lucide-react";
import { Handle, Position } from "reactflow";

import { Badge } from "@integramind/ui/badge";
import { Button } from "@integramind/ui/button";
import { Card } from "@integramind/ui/card";
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

import type { WorkflowTriggerBlockData } from "~/types";
import { CreateWorkflowForm } from "~/components/create-workflow-form";
import { useDevelopmentSheetStore } from "~/lib/store";

export const WorkflowBlock = memo(
  ({ data, isConnectable, selected }: NodeProps<WorkflowTriggerBlockData>) => {
    const currentId = useDevelopmentSheetStore((state) => state.currentId);
    const updateCurrentId = useDevelopmentSheetStore(
      (state) => state.updateCurrentId,
    );
    const removeCurrentId = useDevelopmentSheetStore(
      (state) => state.removeCurrentId,
    );

    return (
      <>
        <Sheet modal={false} open={currentId === data.id}>
          <SheetTrigger
            onClick={() => updateCurrentId(data.id)}
            className="cursor-grab"
          >
            <Card
              className={cn(
                "flex h-[84px] w-[256px] flex-col gap-2 px-5 py-4",
                {
                  "border-primary": selected,
                },
              )}
            >
              <div className="flex w-full items-center gap-2 text-xs">
                <Badge>{data.triggerType}</Badge>
                <span className="text-muted-foreground">Workflow</span>
              </div>
              <span className="flex w-full justify-start text-sm">
                {data.name}
              </span>
            </Card>
          </SheetTrigger>
          <SheetContent className="right-2 top-16 flex h-[calc(100dvh-72px)] w-full flex-col gap-4 rounded-xl border bg-muted">
            <SheetHeader>
              <SheetTitle className="flex w-full items-center justify-between">
                <div className="flex w-full items-center gap-2">
                  <Badge variant="default" className="text-xs">
                    {data.triggerType}
                  </Badge>
                  <span>Workflow</span>
                </div>
                <SheetClose onClick={() => removeCurrentId()}>
                  <Button variant="ghost" size="icon">
                    <X className="size-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </SheetClose>
              </SheetTitle>
              <SheetDescription>
                Edit your workflow settings here
              </SheetDescription>
            </SheetHeader>
            {/* FIXME: Pass initial values */}
            <CreateWorkflowForm />
          </SheetContent>
        </Sheet>
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

WorkflowBlock.displayName = "WorkflowBlock";
