"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Handle,
  Position,
  useEdges,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import type { EditorState, LexicalEditor, ParagraphNode } from "lexical";
import { $getRoot } from "lexical";
import {
  CircleAlertIcon,
  CircleMinus,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  LockIcon,
  PlayCircleIcon,
  TrashIcon,
  UnlockIcon,
} from "lucide-react";
import Link from "next/link";
import { memo, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@integramind/ui/resizable";
import { ScrollArea } from "@integramind/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@integramind/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@integramind/ui/tabs";
import { cn } from "@integramind/ui/utils";

import type {
  FunctionPrimitive,
  Input as IInput,
  Primitive,
  RawDescription,
} from "@integramind/shared/types";
import type { resourceProvidersSchema } from "@integramind/shared/validators/resources";
import { LambdaIcon } from "@integramind/ui/icons/lambda-icon";
import { useQuery } from "@tanstack/react-query";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import Editor from "~/components/editor";
import type { ReferenceNode } from "~/components/editor/nodes/reference-node";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode, FlowNodeProps } from "~/types";
import { PrimitiveDropdownMenu } from "./primitive-dropdown-menu";

async function executeFunction({
  id,
}: {
  id: string;
}): Promise<{ result: Record<string, string | number>[] }> {
  const response = await fetch(
    `http://localhost:3002/api/execute/primitives/${id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (response.status !== 200) {
    throw new Error("Failed to execute function");
  }

  const data = (await response.json()) as {
    result: Record<string, string | number>[];
  };

  return data;
}

const validationSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required",
    })
    .regex(/^[a-z0-9_]+$/, {
      message:
        "Name must only contain lowercase letters, numbers, and underscores",
    })
    .regex(/^[a-z0-9].*[a-z0-9]$/, {
      message: "Name must not start or end with an underscore",
    })
    .regex(/^(?!.*__).*$/, {
      message: "Name must not contain consecutive underscores",
    }),
  description: z.string().min(1, {
    message: "Description is required",
  }),
});

export const FunctionNode = memo(
  ({
    data: _data,
    selected,
    positionAbsoluteX,
    positionAbsoluteY,
    parentId,
  }: FlowNodeProps) => {
    if (_data.type !== "function") {
      throw new Error("Invalid node type");
    }

    const { data: fetchedData, refetch } = api.primitives.getById.useQuery(
      {
        id: _data.id,
      },
      {
        refetchInterval: 5 * 60 * 1000,
        initialData: _data,
      },
    );
    const data = fetchedData as FunctionPrimitive;

    const { deleteElements, setNodes, fitBounds } = useReactFlow<
      FlowNode,
      FlowEdge
    >();
    const nodes = useNodes<FlowNode>();
    const edges = useEdges<FlowEdge>();
    const form = useForm<z.infer<typeof validationSchema>>({
      mode: "all",
      criteriaMode: "all",
      reValidateMode: "onChange",
      resolver: zodResolver(validationSchema),
      defaultValues: {
        name: data.name ?? undefined,
        description: data.description ?? undefined,
      },
    });

    const updateFunction = api.primitives.update.useMutation({
      onSuccess: async () => {
        await refetch();
      },
    });

    const deleteFunction = api.primitives.delete.useMutation();

    const {
      data: executionResult,
      refetch: refetchExecutionResult,
      isLoading: isLoadingExecutionResult,
      isRefetching: isRefetchingExecutionResult,
    } = useQuery({
      queryKey: [`execution-result-${data.id}`],
      queryFn: () => executeFunction({ id: data.id }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      enabled: false,
    });

    const inputs = useMemo(() => {
      const parents = edges.reduce((acc: Primitive[], edge) => {
        if (edge.target === data.id) {
          const parent = nodes.find((node) => node.id === edge.source);
          if (parent) {
            acc.push(parent.data);
          }
        }
        return acc;
      }, []);

      const inputs = parents.reduce((acc, parent) => {
        if (parent.type === "route" || parent.type === "workflow") {
          if (parent.metadata.inputs) {
            for (const input of parent.metadata.inputs) {
              if (data.metadata.inputs) {
                const foundInput = data.metadata.inputs.find(
                  (item) => item.id === input.id,
                );

                if (foundInput && foundInput.testValue !== input.testValue) {
                  updateFunction.mutate({
                    where: {
                      id: data.id,
                      flowId: data.flowId,
                    },
                    payload: {
                      type: "function",
                      metadata: {
                        inputs: data.metadata.inputs.map((item) =>
                          item.id === input.id
                            ? {
                                ...item,
                                testValue: input.testValue,
                              }
                            : item,
                        ),
                      },
                    },
                  });
                }
              }

              acc.push({
                id: input.id,
                name: input.name,
                type: input.type,
                testValue: input.testValue,
              });
            }
          }
        } else if (parent.type === "function") {
          if (parent.metadata.outputs && parent.name) {
            acc.push({
              id: parent.id,
              name: parent.name,
              type: "functionResponse",
              testValue: null,
            });
            for (const output of parent.metadata.outputs) {
              acc.push({
                id: output.id,
                name: `${parent.name}.${output.name}`,
                type: output.type,
                testValue: null,
              });
            }
          }
        }
        return acc;
      }, [] as IInput[]);

      return inputs;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, edges, nodes, updateFunction]);

    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);

    function onChange(editorState: EditorState) {
      editorState.read(async () => {
        const root = $getRoot();
        const children = (root.getChildren()[0] as ParagraphNode).getChildren();

        const description = root.getTextContent();
        const rawDescription = children.reduce((acc, child) => {
          if (child.__type === "text") {
            acc.push({
              type: "text",
              value: child.getTextContent(),
            });
          } else if (child.__type === "reference") {
            const referenceNode = child as ReferenceNode;
            acc.push({
              type: "reference",
              id: referenceNode.__id,
              referenceType: referenceNode.__referenceType,
              name: referenceNode.__name,
              icon: referenceNode.__icon,
              dataType: referenceNode.__dataType,
              testValue: referenceNode.__testValue ?? null,
            });
          }
          return acc;
        }, [] as RawDescription[]);
        const inputs: IInput[] = [];
        let resource: {
          id: string;
          provider: z.infer<typeof resourceProvidersSchema>;
        } | null = null;

        for (const child of children) {
          if (child.__type === "reference") {
            const referenceNode = child as ReferenceNode;
            if (
              referenceNode.__referenceType === "input" &&
              referenceNode.__dataType
            ) {
              inputs.push({
                id: referenceNode.__id,
                name: referenceNode.__name,
                type: referenceNode.__dataType,
                testValue: referenceNode.__testValue ?? null,
              });
            } else if (referenceNode.__referenceType === "database") {
              resource = {
                id: referenceNode.__id,
                provider: "postgres",
              };
            }
          }
        }

        updateFunction.mutate({
          where: {
            id: data.id,
            flowId: data.flowId,
          },
          payload: {
            type: "function",
            description,
            metadata: {
              inputs,
              resource,
              rawDescription,
              isCodeUpdated:
                data.description?.trim().toLowerCase() ===
                description.trim().toLowerCase(),
            },
          },
        });
      });
    }

    function onError(error: Error, _editor: LexicalEditor) {
      console.error(error);
    }

    return (
      <>
        <ExpandableCard>
          <ContextMenu>
            <ContextMenuTrigger>
              <ExpandableCardTrigger>
                <Card
                  className={cn(
                    "drag-handle flex h-[84px] w-[256px] cursor-grab flex-col items-start justify-center gap-2 px-5 py-4 dark:bg-muted",
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
                      <LambdaIcon className="size-4 text-primary" />
                      <span className="text-muted-foreground">Function</span>
                    </div>
                    {(!data.name || !data.description) && (
                      <CircleAlertIcon className="size-4 text-destructive" />
                    )}
                  </div>
                  <span className="text-sm">{data.name ?? "new_function"}</span>
                </Card>
              </ExpandableCardTrigger>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuLabel className="text-xs">Function</ContextMenuLabel>
              <ContextMenuSeparator />
              {parentId && (
                <ContextMenuItem
                  className="text-xs"
                  onClick={async () => {
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
                      await updateFunction.mutateAsync({
                        where: {
                          id: data.id,
                          flowId: data.flowId,
                        },
                        payload: {
                          type: "function",
                          parentId: undefined,
                        },
                      });
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
                    <LambdaIcon className="size-4 text-primary" />
                    <span className="text-muted-foreground">Function</span>
                  </div>
                  <div className="flex items-center">
                    <Button
                      className="size-7 text-success hover:text-success"
                      variant="ghost"
                      size="icon"
                      aria-disabled={
                        isLoadingExecutionResult || isRefetchingExecutionResult
                      }
                      disabled={
                        isLoadingExecutionResult || isRefetchingExecutionResult
                      }
                      onClick={async () => {
                        await refetchExecutionResult();
                      }}
                    >
                      <PlayCircleIcon className="size-3.5" />
                    </Button>
                    <Button
                      className="size-7 text-muted-foreground hover:text-muted-foreground"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        updateFunction.mutate({
                          where: {
                            id: data.id,
                            flowId: data.flowId,
                          },
                          payload: {
                            type: "function",
                            metadata: {
                              isLocked: !data.metadata.isLocked,
                            },
                          },
                        });
                      }}
                    >
                      {data.metadata.isLocked ? (
                        <LockIcon className="size-3.5" />
                      ) : (
                        <UnlockIcon className="size-3.5" />
                      )}
                    </Button>
                    <PrimitiveDropdownMenu
                      setDeleteAlertDialogOpen={setDeleteAlertDialogOpen}
                      label="Function"
                      docsUrlPath="function"
                    />
                  </div>
                </div>
              </ExpandableCardHeader>
              <div className="flex flex-col h-full gap-6">
                <Form {...form}>
                  <div className="px-4">
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
                              placeholder="function_name"
                              onBlur={(e) => {
                                form.setValue("name", e.target.value);
                                updateFunction.mutate({
                                  where: {
                                    id: data.id,
                                    flowId: data.flowId,
                                  },
                                  payload: {
                                    type: "function",
                                    name: e.target.value,
                                    metadata: {
                                      isCodeUpdated:
                                        e.target.value === data.name,
                                    },
                                  },
                                });
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <ResizablePanelGroup
                    direction="vertical"
                    className="flex h-full"
                  >
                    <ResizablePanel
                      defaultSize={65}
                      minSize={25}
                      className="px-4 pb-4"
                    >
                      <FormField
                        control={form.control}
                        name="description"
                        render={() => (
                          <FormItem className="flex flex-col h-full">
                            <FormLabel className="text-xs">Editor</FormLabel>
                            <Editor
                              id={data.id}
                              type="description"
                              inputs={inputs}
                              placeholder="Describe your function"
                              rawDescription={data.metadata.rawDescription}
                              onChange={onChange}
                              onError={onError}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </ResizablePanel>
                    <ResizableHandle className="border-b" withHandle />
                    <ResizablePanel
                      defaultSize={35}
                      minSize={8}
                      className="flex size-full rounded-b-xl p-4"
                    >
                      <Tabs
                        defaultValue="result"
                        className="flex w-full flex-col space-y-4"
                      >
                        <TabsList className="w-full justify-start bg-accent">
                          <TabsTrigger className="w-full" value="result">
                            Result
                          </TabsTrigger>
                          <TabsTrigger className="w-full" value="summary">
                            Summary
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent
                          value="result"
                          className="size-full rounded-lg bg-background"
                        >
                          <div className="flex size-full items-center justify-center px-6">
                            {!executionResult ? (
                              <>
                                {isLoadingExecutionResult ||
                                isRefetchingExecutionResult ? (
                                  <div className="flex items-center justify-center">
                                    <Loader2Icon className="size-4 animate-spin text-primary" />
                                  </div>
                                ) : (
                                  <div className="text-sm text-muted-foreground">
                                    Click run to execute the function
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                {isLoadingExecutionResult ||
                                isRefetchingExecutionResult ? (
                                  <div className="flex items-center justify-center">
                                    fuck
                                    <Loader2Icon className="size-4 animate-spin text-primary" />
                                  </div>
                                ) : (
                                  <ScrollArea className="size-full">
                                    <Table className="flex w-full flex-col">
                                      <TableHeader className="flex w-full">
                                        <TableRow className="flex w-full">
                                          {Object.keys(
                                            executionResult.result[0] ?? {},
                                          ).map((head, idx) => (
                                            <TableHead
                                              key={`${idx}-${head}`}
                                              className="flex w-full items-center"
                                            >
                                              {head}
                                            </TableHead>
                                          ))}
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody className="flex w-full flex-col">
                                        {executionResult.result.map(
                                          (
                                            row: Record<
                                              string,
                                              string | number
                                            >,
                                            idx,
                                          ) => (
                                            <TableRow
                                              key={`${idx}-${row.id}`}
                                              className="flex w-full"
                                            >
                                              {Object.keys(row).map(
                                                (key: string, idx) => (
                                                  <TableCell
                                                    key={`${idx}-${key}`}
                                                    className="flex w-full"
                                                  >
                                                    {row[key]}
                                                  </TableCell>
                                                ),
                                              )}
                                            </TableRow>
                                          ),
                                        )}
                                      </TableBody>
                                    </Table>
                                  </ScrollArea>
                                )}
                              </>
                            )}
                          </div>
                        </TabsContent>
                        <TabsContent
                          value="summary"
                          className="size-full rounded-lg bg-background"
                        >
                          <div className="flex size-full items-center justify-center px-6 text-muted-foreground">
                            General info
                          </div>
                        </TabsContent>
                      </Tabs>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </Form>
              </div>
            </div>
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
            deleteElements({
              nodes: [
                {
                  id: data.id,
                },
              ],
            });
            deleteFunction.mutate({
              id: data.id,
            });
          }}
        />
      </>
    );
  },
);
