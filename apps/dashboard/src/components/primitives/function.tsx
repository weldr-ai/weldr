"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Handle,
  Position,
  useHandleConnections,
  useNodes,
  useNodesData,
  useReactFlow,
} from "@xyflow/react";
import type { EditorState, LexicalEditor, ParagraphNode } from "lexical";
import { $getRoot } from "lexical";
import {
  ArrowUpIcon,
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

import { Button } from "@specly/ui/button";
import { Card } from "@specly/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@specly/ui/context-menu";
import {
  ExpandableCard,
  ExpandableCardContent,
  ExpandableCardHeader,
  ExpandableCardTrigger,
} from "@specly/ui/expandable-card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@specly/ui/form";
import { Input } from "@specly/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@specly/ui/resizable";
import { ScrollArea } from "@specly/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@specly/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@specly/ui/tabs";
import { cn } from "@specly/ui/utils";

import type {
  FunctionPrimitive,
  Input as IInput,
  RawDescription,
} from "@specly/shared/types";
import type { resourceProvidersSchema } from "@specly/shared/validators/resources";
import { LambdaIcon } from "@specly/ui/icons/lambda-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@specly/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "perfect-debounce";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import Editor from "~/components/editor";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode, FlowNodeProps } from "~/types";
import type { ReferenceNode } from "../editor/nodes/reference-node";
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
    const { deleteElements, setNodes, fitBounds } = useReactFlow<
      FlowNode,
      FlowEdge
    >();
    const nodes = useNodes<FlowNode>();
    const parents = useHandleConnections({ type: "target" });
    const parentsData = useNodesData<FlowNode>(
      parents.map((parent) => parent.source),
    );

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

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    const inputs = useMemo(() => {
      const inputs = parentsData.reduce((acc, parent) => {
        if (parent.type === "route" || parent.type === "workflow") {
          if (parent.data.metadata.inputs) {
            for (const input of parent.data.metadata.inputs) {
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
          const functionParent = parent.data as FunctionPrimitive;

          if (functionParent.metadata.outputs && parent.data.name) {
            acc.push({
              id: parent.id,
              name: parent.data.name,
              type: "text",
              testValue: null,
            });

            for (const output of functionParent.metadata.outputs) {
              acc.push({
                id: output.id,
                name: `${parent.data.name}.${output.name}`,
                type: output.type,
                testValue: null,
              });
            }
          }
        }
        return acc;
      }, [] as IInput[]);

      return inputs;
    }, [data, parentsData]);

    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);

    const [chat, setChat] = useState<string | null>(null);

    const onDescriptionChange = debounce(
      (editorState: EditorState) => {
        editorState.read(async () => {
          const root = $getRoot();
          const children = (
            root.getChildren()[0] as ParagraphNode
          ).getChildren();

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
              });
            }
            return acc;
          }, [] as RawDescription[]);

          const inputs: IInput[] = [];

          const resources: {
            id: string;
            provider: z.infer<typeof resourceProvidersSchema>;
          }[] = [];

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
                resources.push({
                  id: referenceNode.__id,
                  provider: "postgres",
                });
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
                resources,
                rawDescription,
                isCodeUpdated:
                  data.description?.trim().toLowerCase() ===
                  description.trim().toLowerCase(),
              },
            },
          });
        });
      },
      500,
      { trailing: false },
    );

    function onChatChange(editorState: EditorState) {
      editorState.read(async () => {
        const root = $getRoot();
        const chat = root.getTextContent();
        setChat(chat);
      });
    }

    function onError(error: Error, _editor: LexicalEditor) {
      console.error(error);
    }

    const updateFunctionName = debounce(
      async (value: string) => {
        await updateFunction.mutateAsync({
          where: {
            id: data.id,
            flowId: data.flowId,
          },
          payload: {
            type: "function",
            name: value,
          },
        });
      },
      500,
      { trailing: false },
    );

    return (
      <>
        <ExpandableCard>
          <ContextMenu>
            <ContextMenuTrigger>
              <ExpandableCardTrigger>
                <Card
                  className={cn(
                    "drag-handle flex h-[84px] w-[256px] cursor-grab flex-col items-start justify-center gap-2 px-5 py-4 dark:bg-muted",
                    "hover:shadow-lg hover:shadow-black",
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
                    console.log(parent);
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
                          parentId: null,
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
                  href="https://docs.specly.ai/primitives/function"
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
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger>
                          <Button
                            className="size-7 text-success hover:text-success"
                            variant="ghost"
                            size="icon"
                            aria-disabled={
                              isLoadingExecutionResult ||
                              isRefetchingExecutionResult
                            }
                            disabled={
                              isLoadingExecutionResult ||
                              isRefetchingExecutionResult
                            }
                            onClick={async () => {
                              await refetchExecutionResult();
                            }}
                          >
                            <PlayCircleIcon className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-muted border">
                          <span className="text-success">Run</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger>
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
                        </TooltipTrigger>
                        <TooltipContent className="bg-muted border">
                          <span>
                            {data.metadata.isLocked ? "Unlock" : "Lock"}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger>
                          <PrimitiveDropdownMenu
                            setDeleteAlertDialogOpen={setDeleteAlertDialogOpen}
                            label="Function"
                            docsUrlPath="function"
                          />
                        </TooltipTrigger>
                        <TooltipContent className="bg-muted border">
                          <span>More</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
                                field.onChange(e);
                                const isValid =
                                  validationSchema.shape.name.safeParse(
                                    e.target.value,
                                  ).success;
                                if (isValid) {
                                  updateFunctionName(e.target.value);
                                }
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
                            <FormLabel className="text-xs">
                              Description
                            </FormLabel>
                            <Editor
                              id={data.id}
                              primitive={data}
                              type="description"
                              inputs={inputs}
                              placeholder="Describe your function"
                              onChange={onDescriptionChange}
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
                        defaultValue="chat"
                        className="flex w-full flex-col space-y-2"
                      >
                        <TabsList className="w-full justify-start bg-accent">
                          <TabsTrigger className="w-full" value="chat">
                            Chat
                          </TabsTrigger>
                          <TabsTrigger className="w-full" value="result">
                            Result
                          </TabsTrigger>
                          <TabsTrigger className="w-full" value="summary">
                            Summary
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent
                          value="chat"
                          className="size-full rounded-lg bg-background"
                        >
                          <div className="size-full relative">
                            <Editor
                              id={data.id}
                              type="description"
                              inputs={inputs}
                              placeholder="Doesn't work as expected? Write extra context here..."
                              onChange={onChatChange}
                              onError={onError}
                            />
                            <Button
                              className="size-8 absolute bottom-2 right-2"
                              size="icon"
                              disabled={!chat}
                            >
                              <ArrowUpIcon className="size-3.5" />
                            </Button>
                          </div>
                        </TabsContent>
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
