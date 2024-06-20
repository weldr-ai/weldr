"use client";

import type { z } from "zod";
import { memo } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PlayCircleIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Handle, Position, useReactFlow } from "reactflow";

import { updateRouteFlowSchema } from "@integramind/db/schema";
import { Badge } from "@integramind/ui/badge";
import { Button } from "@integramind/ui/button";
import { Card } from "@integramind/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
import {
  ExpandableCard,
  ExpandableCardContent,
  ExpandableCardHeader,
  ExpandableCardTrigger,
} from "@integramind/ui/expandable-card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@integramind/ui/form";
import { Input } from "@integramind/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@integramind/ui/select";
import { Textarea } from "@integramind/ui/textarea";
import { cn } from "@integramind/ui/utils";

import type { RouteNodeProps } from "~/types";
import { updatePrimitiveRouteById } from "~/lib/queries/primitives";

export const Route = memo(
  ({ data, isConnectable, xPos, yPos, selected }: RouteNodeProps) => {
    const reactFlow = useReactFlow();
    const form = useForm<z.infer<typeof updateRouteFlowSchema>>({
      mode: "onChange",
      resolver: zodResolver(updateRouteFlowSchema),
      defaultValues: {
        name: data.name,
        description: data.description ?? undefined,
        actionType: data.actionType,
        urlPath: data.urlPath,
        inputs: data.inputs,
      },
    });

    return (
      <>
        <ExpandableCard>
          <ExpandableCardTrigger>
            <Card
              className={cn(
                "drag-handle flex h-[84px] w-[256px] cursor-grab flex-col gap-2 px-5 py-4",
                {
                  "border-primary": selected,
                },
              )}
              onClick={() => {
                reactFlow.fitBounds(
                  {
                    x: xPos,
                    y: yPos,
                    width: 400,
                    height: 400 + 300,
                  },
                  {
                    duration: 500,
                  },
                );
              }}
            >
              <div className="flex w-full items-center gap-2 text-xs">
                <Badge>{form.getValues().actionType ?? data.actionType}</Badge>
                <span className="text-muted-foreground">Route</span>
              </div>
              <span className="flex w-full justify-start text-sm">
                {form.getValues().name ?? data.name}
              </span>
            </Card>
          </ExpandableCardTrigger>
          <ExpandableCardContent className="flex flex-col p-0">
            <ExpandableCardHeader className="flex flex-col items-start justify-start px-6">
              <div className="flex w-full items-center justify-between">
                <div className="flex w-full items-center gap-2">
                  <Badge variant="default" className="text-xs">
                    {form.getValues().actionType ?? data.actionType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Route</span>
                </div>
                <div className="flex items-center">
                  <Button
                    className="size-7 text-success hover:text-success"
                    variant="ghost"
                    size="icon"
                  >
                    <PlayCircleIcon className="size-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button
                        className="size-7 text-muted-foreground hover:text-muted-foreground"
                        variant="ghost"
                        size="icon"
                      >
                        <EllipsisVerticalIcon className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuLabel className="text-xs">
                        Route
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-xs">
                        <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
                        Run
                      </DropdownMenuItem>
                      <DropdownMenuItem className="flex items-center justify-between text-xs">
                        <Link
                          className="flex items-center"
                          href="https://docs.integramind.ai/primitives/route"
                          target="blank"
                        >
                          <FileTextIcon className="mr-3 size-4 text-muted-foreground" />
                          Docs
                        </Link>
                        <ExternalLinkIcon className="size-3 text-muted-foreground" />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </ExpandableCardHeader>
            <form className="flex h-full flex-col gap-2 px-6 pb-6">
              <Form {...form}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter route name"
                          onChange={async (e) => {
                            field.onChange(e.target.value);
                            await updatePrimitiveRouteById({
                              id: data.id,
                              name: e.target.value,
                            });
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        Description{" "}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter route description"
                          value={field.value}
                          onChange={async (e) => {
                            field.onChange(e.target.value);
                            await updatePrimitiveRouteById({
                              id: data.id,
                              description: e.target.value,
                            });
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="actionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Type</FormLabel>
                      <FormControl>
                        <Select
                          {...field}
                          name={field.name}
                          onValueChange={async (value) => {
                            field.onChange(value);
                            await updatePrimitiveRouteById({
                              id: data.id,
                              actionType: value as
                                | "create"
                                | "read"
                                | "update"
                                | "delete",
                            });
                          }}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Action Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="create">Create</SelectItem>
                            <SelectItem value="read">Read</SelectItem>
                            <SelectItem value="update">Update</SelectItem>
                            <SelectItem value="delete">Delete</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="urlPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">URL Path</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter action URL path"
                          value={field.value}
                          onChange={async (e) => {
                            field.onChange(e.target.value);
                            await updatePrimitiveRouteById({
                              id: data.id,
                              urlPath: e.target.value,
                            });
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Form>
            </form>
          </ExpandableCardContent>
        </ExpandableCard>
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

Route.displayName = "Route";
