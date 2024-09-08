"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type {
  EditorState,
  LexicalEditor,
  SerializedLexicalNode,
  SerializedParagraphNode,
  SerializedRootNode,
} from "lexical";
import {
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PlayCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

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

import type {
  RoutePrimitive,
  Input as TInput,
} from "@integramind/shared/types";
import { updateRouteFlowSchema } from "@integramind/shared/validators/flows";
import { Label } from "@integramind/ui/label";
import Editor from "~/components/editor";
import type { SerializedInputNode } from "~/components/editor/nodes/input-node";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode, FlowNodeProps } from "~/types";

export const Route = memo(
  ({
    data: _data,
    isConnectable,
    positionAbsoluteX,
    positionAbsoluteY,
    selected,
  }: FlowNodeProps) => {
    if (_data.type !== "route") {
      return;
    }

    const { data: fetchedData, refetch } = api.primitives.getById.useQuery(
      {
        id: _data.id,
      },
      {
        refetchInterval: false,
        initialData: _data,
      },
    );
    const data = fetchedData as RoutePrimitive;

    const updateRoute = api.primitives.update.useMutation({
      onSuccess: async () => {
        await refetch();
      },
    });

    const reactFlow = useReactFlow<FlowNode, FlowEdge>();

    const form = useForm<z.infer<typeof updateRouteFlowSchema>>({
      resolver: zodResolver(updateRouteFlowSchema),
      defaultValues: {
        name: data.name ?? undefined,
        description: data.description ?? undefined,
        method: data.metadata.method,
        path: data.metadata.path,
        inputs: data.metadata.inputs,
      },
    });

    function onChange(editorState: EditorState) {
      const getInputs = (root: SerializedRootNode<SerializedLexicalNode>) => {
        const paragraph = root.children.find(
          (child) => child.type === "paragraph",
        ) as SerializedParagraphNode | undefined;

        if (paragraph) {
          return paragraph.children.reduce((acc, child) => {
            if (child.type === "input") {
              acc.push({
                id: (child as SerializedInputNode).inputId,
                name: (child as SerializedInputNode).name,
                testValue: (child as SerializedInputNode).testValue ?? null,
                type: (child as SerializedInputNode).inputType,
              });
            }
            return acc;
          }, [] as TInput[]);
        }
      };

      editorState.read(async () => {
        const { root } = editorState.toJSON();
        const inputs = getInputs(root);
        updateRoute.mutate({
          where: {
            id: data.id,
            flowId: data.flowId,
          },
          payload: {
            type: "route",
            metadata: {
              inputs,
            },
          },
        });
        reactFlow.setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id === data.id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  inputs,
                },
              };
            }
            return node;
          }),
        );
      });
    }

    function onError(error: Error, _editor: LexicalEditor) {
      console.error(error);
    }

    return (
      <>
        <ExpandableCard>
          <ExpandableCardTrigger>
            <Card
              className={cn(
                "drag-handle flex h-[84px] w-[256px] cursor-grab flex-col gap-2 px-5 py-4",
                "hover:shadow-lg hover:shadow-black",
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
              <div className="flex w-full items-center gap-2 text-xs">
                <Badge>{data.metadata.method.toUpperCase()}</Badge>
                <span className="text-muted-foreground">Route</span>
              </div>
              <span className="flex w-full justify-start text-sm">
                {data.name}
              </span>
            </Card>
          </ExpandableCardTrigger>
          <ExpandableCardContent className="nowheel flex flex-col p-0">
            <ExpandableCardHeader className="flex flex-col items-start justify-start">
              <div className="flex w-full items-center justify-between">
                <div className="flex w-full items-center gap-2">
                  <Badge variant="default" className="text-xs">
                    {data.metadata.method.toUpperCase()}
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
            <Form {...form}>
              <div className="flex flex-col gap-6 px-4 pb-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="off"
                          className="h-8 border-none shadow-none dark:bg-muted p-0 text-base focus-visible:ring-0"
                          placeholder="Route name"
                          onBlur={async (e) => {
                            const isValid =
                              updateRouteFlowSchema.shape.name.safeParse(
                                e.target.value,
                              ).success;
                            if (isValid) {
                              await updateRoute.mutateAsync({
                                where: {
                                  id: data.id,
                                  flowId: data.flowId,
                                },
                                payload: {
                                  type: "route",
                                  name: e.target.value,
                                },
                              });
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col gap-2">
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
                            autoComplete="off"
                            placeholder="Enter route description"
                            value={field.value}
                            onBlur={async (e) => {
                              const isValid =
                                updateRouteFlowSchema.shape.description.safeParse(
                                  e.target.value,
                                ).success;
                              if (isValid) {
                                await updateRoute.mutateAsync({
                                  where: {
                                    id: data.id,
                                    flowId: data.flowId,
                                  },
                                  payload: {
                                    type: "route",
                                    description: e.target.value,
                                  },
                                });
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Method</FormLabel>
                        <FormControl>
                          <Select
                            {...field}
                            autoComplete="off"
                            name={field.name}
                            onValueChange={async (value) => {
                              field.onChange(value);
                              const isValid =
                                updateRouteFlowSchema.shape.method.safeParse(
                                  value,
                                ).success;
                              if (isValid) {
                                await updateRoute.mutateAsync({
                                  where: {
                                    id: data.id,
                                    flowId: data.flowId,
                                  },
                                  payload: {
                                    type: "route",
                                    metadata: {
                                      method:
                                        value as RoutePrimitive["metadata"]["method"],
                                    },
                                  },
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue
                                placeholder="Select method"
                                className="placeholder-muted-foreground"
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="get">GET</SelectItem>
                              <SelectItem value="post">POST</SelectItem>
                              <SelectItem value="patch">PATCH</SelectItem>
                              <SelectItem value="delete">DELETE</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="path"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">URL Path</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete="off"
                            placeholder="Enter action URL path"
                            value={field.value}
                            onBlur={async (e) => {
                              const isValid =
                                updateRouteFlowSchema.shape.path.safeParse(
                                  e.target.value,
                                ).success;
                              if (isValid) {
                                await updateRoute.mutateAsync({
                                  where: {
                                    id: data.id,
                                    flowId: data.flowId,
                                  },
                                  payload: {
                                    type: "route",
                                    metadata: {
                                      path: e.target.value,
                                    },
                                  },
                                });
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <Label className="text-xs">Inputs</Label>
                    <Editor
                      id={data.id}
                      onChange={onChange}
                      onError={onError}
                      inputs={data.metadata.inputs ?? []}
                      type="inputs"
                      className="h-20"
                      placeholder="Enter inputs"
                    />
                  </div>
                </div>
              </div>
            </Form>
          </ExpandableCardContent>
        </ExpandableCard>
        <Handle
          type="source"
          className="border rounded-full bg-background p-1"
          position={Position.Right}
        />
      </>
    );
  },
);

Route.displayName = "Route";
