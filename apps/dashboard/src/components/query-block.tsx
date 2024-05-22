import type { NodeProps } from "reactflow";
import { memo, useState } from "react";
import Link from "next/link";
import {
  Database,
  ExternalLink,
  FileText,
  PlayCircle,
  Trash,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@integramind/ui/form";
import { Input } from "@integramind/ui/input";
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

import type { QueryBlockData } from "~/types";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { TextHighlighter } from "~/components/text-highlighter";
import { useDevelopmentSheetStore } from "~/lib/store";

export const QueryBlock = memo(
  ({ data, isConnectable, selected }: NodeProps<QueryBlockData>) => {
    const form = useForm();
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
        <Sheet modal={false} open={currentId === data.id}>
          <SheetTrigger
            onClick={() => updateCurrentId(data.id)}
            className="cursor-grab"
          >
            <ContextMenu>
              <ContextMenuTrigger>
                <Card
                  className={cn(
                    "flex h-[78px] w-[256px] flex-col items-start gap-2 px-5 py-4",
                    {
                      "border-primary": selected,
                    },
                  )}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <Database className="size-4 stroke-1 text-primary" />
                    <span className="text-muted-foreground">Query</span>
                  </div>
                  <span className="text-sm">{data.name}</span>
                </Card>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuLabel className="text-xs">Query</ContextMenuLabel>
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
          </SheetTrigger>
          <SheetContent className="right-2 top-16 flex h-[calc(100dvh-72px)] w-full flex-col gap-4 rounded-xl border bg-muted">
            <SheetHeader>
              <SheetTitle className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="size-4 stroke-1 text-primary" />
                  <span>Query</span>
                </div>
                <SheetClose onClick={() => removeCurrentId()}>
                  <Button variant="ghost" size="icon">
                    <X className="size-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </SheetClose>
              </SheetTitle>
              <SheetDescription>Develop your query here</SheetDescription>
            </SheetHeader>
            <Form {...form}>
              <form className="flex w-full flex-col space-y-4">
                <FormField
                  control={form.control}
                  name="..."
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter query name" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="..."
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <TextHighlighter
                          value={field.value as string}
                          placeholder="Write a description of the query"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </SheetContent>
        </Sheet>
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

QueryBlock.displayName = "QueryBlock";
