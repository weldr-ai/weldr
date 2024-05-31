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

import type { AccessPointBlockData } from "~/types";
import { CreateAccessPointForm } from "~/components/create-access-point-form";
import { useDevelopmentSheetStore } from "~/lib/store";

export const AccessPointBlock = memo(
  ({ data, isConnectable, selected }: NodeProps<AccessPointBlockData>) => {
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
                <Badge>{data.actionType}</Badge>
                <span className="text-muted-foreground">Access Point</span>
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
                    {data.actionType}
                  </Badge>
                  <span>Access Point</span>
                </div>
                <SheetClose onClick={() => removeCurrentId()}>
                  <Button variant="ghost" size="icon">
                    <X className="size-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </SheetClose>
              </SheetTitle>
              <SheetDescription>
                Edit your access point settings here
              </SheetDescription>
            </SheetHeader>
            {/* FIXME: Pass initial values */}
            <CreateAccessPointForm />
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

AccessPointBlock.displayName = "AccessPointBlock";
