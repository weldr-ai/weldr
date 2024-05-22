"use client";

import type { NodeProps } from "reactflow";
import { memo } from "react";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { Handle, Position } from "reactflow";

import { Badge } from "@integramind/ui/badge";
import { Button } from "@integramind/ui/button";
import { Card } from "@integramind/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@integramind/ui/form";
import { Input } from "@integramind/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@integramind/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@integramind/ui/sheet";

import type { AccessPointBlockData } from "~/types";
import { useDevelopmentSheetStore } from "~/lib/store";

export const AccessPointBlock = memo(
  ({ data, isConnectable }: NodeProps<AccessPointBlockData>) => {
    const form = useForm();
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
            <Card className="flex h-[84px] w-[256px] flex-col justify-start gap-2 px-5 py-4">
              <div className="flex w-full items-center gap-2 text-xs">
                <Badge>{data.method}</Badge>
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
                    {data.method}
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
            <Form {...form}>
              <form className="flex w-full flex-col space-y-4">
                <FormField
                  control={form.control}
                  name="..."
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter route name" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="..."
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter route name" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="..."
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Action Type</FormLabel>
                      <FormControl>
                        <Select {...field}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Action Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">Retrieve</SelectItem>
                            <SelectItem value="POST">Submit</SelectItem>
                            <SelectItem value="PATCH">Modify</SelectItem>
                            <SelectItem value="DELETE">Delete</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="..."
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL Path</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter URL path" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </form>
            </Form>
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
