"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { EditorState, LexicalEditor, ParagraphNode } from "lexical";
import { $getRoot } from "lexical";
import {
  EllipsisVerticalIcon,
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
import { Handle, Position, useEdges, useNodes, useReactFlow } from "reactflow";
import type { z } from "zod";

import {
  type resourceProvidersSchema,
  updateFunctionSchema,
  type updatePrimitiveSchema,
} from "@integramind/db/schema";
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
import { FormField } from "@integramind/ui/form";
import { Input as InputComponent } from "@integramind/ui/input";
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

import { LambdaIcon } from "@integramind/ui/icons/lambda-icon";
import { useQuery } from "@tanstack/react-query";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import Editor from "~/components/editor";
import type { ReferenceNode } from "~/components/editor/nodes/reference-node";
import { api } from "~/lib/trpc/react";
import type {
  FunctionMetadata,
  FunctionNodeProps,
  FunctionRawDescription,
  Input,
  PrimitiveData,
} from "~/types";

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

export const FunctionNode = memo(
  ({ data, isConnectable, selected, xPos, yPos }: FunctionNodeProps) => {
    const reactFlow = useReactFlow();
    const nodes = useNodes<PrimitiveData>();
    const edges = useEdges<"deletable-edge">();
    const form = useForm<z.infer<typeof updatePrimitiveSchema>>({
      resolver: zodResolver(updateFunctionSchema),
      defaultValues: {
        payload: {
          name: data.name,
          description: data.description ?? undefined,
        },
      },
    });

    const { data: functionData, refetch: refetchFunctionData } =
      api.primitives.getByIdAndType.useQuery(
        {
          id: data.id,
          type: "function",
        },
        {
          refetchInterval: 5 * 60 * 1000,
          // @ts-ignore - Not sure why it has an error here
          initialData: data,
        },
      );

    const updateFunction = api.primitives.update.useMutation({
      onSuccess: async () => {
        await refetchFunctionData();
      },
    });

    const deletePrimitive = api.primitives.delete.useMutation();

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
      const parents = edges.reduce((acc, edge) => {
        if (edge.target === data.id) {
          const parent = nodes.find((node) => node.id === edge.source);
          if (parent) {
            acc.push(parent.data);
          }
        }
        return acc;
      }, [] as PrimitiveData[]);

      const inputs = parents.reduce((acc, parent) => {
        if (parent.type === "route" || parent.type === "workflow") {
          if (parent.inputs) {
            for (const input of parent.inputs) {
              if (functionData?.metadata.inputs) {
                const foundInput = data.metadata.inputs.find(
                  (item) => item.id === input.id,
                );

                if (foundInput && foundInput.testValue !== input.testValue) {
                  updateFunction.mutate({
                    where: {
                      id: data.id,
                      type: "function",
                    },
                    payload: {
                      metadata: {
                        type: "function",
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
          if (parent.outputs) {
            acc.push({
              id: parent.id,
              name: parent.name,
              type: "functionResponse",
              testValue: null,
            });
            for (const output of parent.outputs) {
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
      }, [] as Input[]);

      return inputs;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, edges, functionData, nodes, updateFunction]);

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
        }, [] as FunctionRawDescription[]);
        const inputs: Input[] = [];
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
            type: "function",
          },
          payload: {
            description,
            metadata: {
              type: "function",
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
        <Handle
          className="border-border bg-background p-1"
          type="target"
          position={Position.Left}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
        <ExpandableCard>
          <ExpandableCardTrigger>
            <ContextMenu>
              <ContextMenuTrigger>
                <Card
                  className={cn(
                    "drag-handle flex h-[84px] w-[256px] cursor-grab flex-col items-start gap-2 px-5 py-4 dark:bg-muted",
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
                  <div className="flex items-center gap-2 text-xs">
                    <LambdaIcon className="size-4 text-primary" />
                    <span className="text-muted-foreground">Function</span>
                  </div>
                  <span className="text-sm">{functionData?.name}</span>
                </Card>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuLabel className="text-xs">
                  Function
                </ContextMenuLabel>
                <ContextMenuSeparator />
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
          </ExpandableCardTrigger>
          <ExpandableCardContent className="nowheel flex h-[600px] w-[800px] flex-col p-0">
            <div className="flex size-full flex-col">
              <ExpandableCardHeader className="flex flex-col items-start justify-start px-4 py-4">
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
                            type: "function",
                          },
                          payload: {
                            metadata: {
                              type: "function",
                              isLocked: !(
                                functionData.metadata as FunctionMetadata
                              ).isLocked,
                            },
                          },
                        });
                      }}
                    >
                      {(functionData.metadata as FunctionMetadata).isLocked ? (
                        <LockIcon className="size-3.5" />
                      ) : (
                        <UnlockIcon className="size-3.5" />
                      )}
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
                          Function
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs">
                          <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
                          Run with previous primitives
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center justify-between text-xs">
                          <Link
                            className="flex items-center"
                            href="https://docs.integramind.ai/primitives/ai-processing"
                            target="blank"
                          >
                            <FileTextIcon className="mr-3 size-4 text-muted-foreground" />
                            Docs
                          </Link>
                          <ExternalLinkIcon className="size-3 text-muted-foreground" />
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="flex text-xs text-destructive hover:text-destructive focus:text-destructive/90"
                          onClick={() => setDeleteAlertDialogOpen(true)}
                        >
                          <TrashIcon className="mr-3 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="payload.name"
                  render={({ field }) => (
                    <InputComponent
                      {...field}
                      autoComplete="off"
                      className="h-8 border-none bg-muted p-0 text-sm focus-visible:ring-0"
                      onBlur={(e) => {
                        updateFunction.mutate({
                          where: {
                            id: data.id,
                            type: "function",
                          },
                          payload: {
                            name: e.target.value,
                            metadata: {
                              type: "function",
                              isCodeUpdated:
                                e.target.value === functionData.name,
                            },
                          },
                        });
                        form.setValue("payload.name", e.target.value);
                      }}
                    />
                  )}
                />
              </ExpandableCardHeader>
              <ResizablePanelGroup direction="vertical" className="flex h-full">
                <ResizablePanel
                  defaultSize={65}
                  minSize={25}
                  className="flex flex-col gap-2 px-4 pb-4"
                >
                  <span className="text-xs text-muted-foreground">Editor</span>
                  <Editor
                    id={data.id}
                    type="description"
                    inputs={inputs}
                    placeholder="Describe your function"
                    rawDescription={
                      (functionData.metadata as FunctionMetadata).rawDescription
                    }
                    onChange={onChange}
                    onError={onError}
                  />
                </ResizablePanel>
                <ResizableHandle className="border-b" withHandle />
                <ResizablePanel
                  defaultSize={35}
                  minSize={8}
                  className="flex size-full rounded-b-xl px-4 py-4"
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
                                <Loader2Icon className="size-6 animate-spin text-primary" />
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
                                <Loader2Icon className="size-6 animate-spin text-primary" />
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
                                        row: Record<string, string | number>,
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
            </div>
          </ExpandableCardContent>
        </ExpandableCard>
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
            deletePrimitive.mutate({
              id: data.id,
            });
          }}
        />
        <Handle
          className="border-border bg-background p-1"
          type="source"
          position={Position.Right}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
      </>
    );
  },
);

FunctionNode.displayName = "Function";
