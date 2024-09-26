"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { Handle, Position, useNodes, useReactFlow } from "@xyflow/react";
import type { EditorState, LexicalEditor, ParagraphNode } from "lexical";
import { $getRoot } from "lexical";
import {
  ArrowUpIcon,
  CircleAlertIcon,
  CircleMinus,
  ColumnsIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HashIcon,
  Loader2Icon,
  LockIcon,
  PlayCircleIcon,
  TableIcon,
  TextIcon,
  TrashIcon,
  UnlockIcon,
  VariableIcon,
} from "lucide-react";
import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { FunctionPrimitive, RawDescription } from "@specly/shared/types";
import { Avatar, AvatarFallback, AvatarImage } from "@specly/ui/avatar";
import { LambdaIcon } from "@specly/ui/icons/lambda-icon";
import { PostgresIcon } from "@specly/ui/icons/postgres-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@specly/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import type { CoreMessage } from "ai";
import { readStreamableValue } from "ai/rsc";
import { debounce } from "perfect-debounce";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import Editor from "~/components/editor";
import { gatherFunctionRequirements } from "~/lib/ai/generator";
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
    const editorRef = useRef<LexicalEditor>(null);
    const { deleteElements, setNodes, fitBounds } = useReactFlow<
      FlowNode,
      FlowEdge
    >();
    const nodes = useNodes<FlowNode>();

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

    useEffect(() => {
      if (data.name) {
        return;
      }

      form.setError("name", {
        type: "required",
        message: "Name is required",
      });
    }, [form.setError, data.name]);

    const updateFunction = api.primitives.update.useMutation({
      onSuccess: async () => {
        await refetch();
      },
    });

    const deleteFunction = api.primitives.delete.useMutation();

    const {
      data: executionResult,
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

    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);

    const [messages, setMessages] = useState<CoreMessage[]>([
      {
        role: "assistant",
        content:
          "Hello there! I'm Specly, your AI assistant. How can I help you today?",
      },
    ]);

    const [rawMessages, setRawMessages] = useState<
      (
        | {
            role: "user";
            content: RawDescription[];
          }
        | {
            role: "assistant";
            content: string;
          }
      )[]
    >([
      {
        role: "assistant",
        content:
          "Hello there! I'm Specly, your AI assistant. How can I help you today?",
      },
    ]);
    const [chatMessage, setChatMessage] = useState<string | null>(null);
    const [rawChatMessage, setRawChatMessage] = useState<RawDescription[]>([]);

    function onChatChange(editorState: EditorState) {
      editorState.read(async () => {
        const root = $getRoot();
        const children = (
          root.getChildren()[0] as ParagraphNode
        )?.getChildren();
        const chat = root.getTextContent();
        const rawDescription = children?.reduce((acc, child) => {
          if (child.__type === "text") {
            acc.push({
              type: "text",
              value: child.getTextContent(),
            });
          }

          if (child.__type === "reference") {
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
        setChatMessage(chat);
        setRawChatMessage(rawDescription);
      });
    }

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const lastMessageRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
      if (lastMessageRef.current && scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector(
          "[data-radix-scroll-area-viewport]",
        );
        if (scrollContainer) {
          const lastMessageRect =
            lastMessageRef.current.getBoundingClientRect();
          const scrollContainerRect = scrollContainer.getBoundingClientRect();
          const offset =
            lastMessageRect.bottom - scrollContainerRect.bottom + 16;

          if (offset > 0) {
            scrollContainer.scrollTop += offset;
          }
        }
      }
    };

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    useEffect(scrollToBottom, [messages]);

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
                        width: 200,
                        height: 700,
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
          <ExpandableCardContent className="nowheel flex h-[600px] w-[60vw] flex-col p-0 -left-[calc(60vw-650px)]">
            <ResizablePanelGroup
              direction="horizontal"
              className="flex size-full"
            >
              <ResizablePanel
                defaultSize={65}
                minSize={20}
                className="flex flex-col"
              >
                <ExpandableCardHeader className="flex flex-col items-start justify-start p-4 border-b">
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <LambdaIcon className="size-4 text-primary" />
                      <span className="text-muted-foreground">Function</span>
                    </div>
                    <div className="flex items-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="size-7 text-success hover:text-success"
                            variant="ghost"
                            size="icon"
                          >
                            <PlayCircleIcon className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-muted border">
                          <span className="text-success">Run</span>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="size-7 text-muted-foreground hover:text-muted-foreground"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              updateFunction.mutate({
                                where: {
                                  id: data.id,
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
                      <Tooltip>
                        <TooltipTrigger asChild>
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
                    </div>
                  </div>
                  <Form {...form}>
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
                              onChange={(e) => {
                                field.onChange(e);
                                debounce(
                                  async () => {
                                    const isValid =
                                      validationSchema.shape.name.safeParse(
                                        e.target.value,
                                      ).success;
                                    if (isValid) {
                                      await updateFunction.mutateAsync({
                                        where: {
                                          id: data.id,
                                        },
                                        payload: {
                                          type: "function",
                                          name: e.target.value,
                                        },
                                      });
                                    }
                                  },
                                  500,
                                  { trailing: false },
                                )();
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </Form>
                </ExpandableCardHeader>
                <div className="flex flex-col h-[calc(100dvh-492px)] p-4">
                  <ScrollArea className="flex-grow mb-2" ref={scrollAreaRef}>
                    <div className="flex flex-col gap-4">
                      {rawMessages.map((rawMessage, idx) => (
                        <>
                          {rawMessage.role === "user" ? (
                            <div
                              className="flex items-start"
                              key={JSON.stringify(rawMessage.content)}
                              ref={
                                idx === messages.length - 1
                                  ? lastMessageRef
                                  : null
                              }
                            >
                              <Avatar className="size-6 rounded-md">
                                <AvatarImage src={undefined} alt="User" />
                                <AvatarFallback>
                                  <div className="size-full bg-gradient-to-br from-rose-500 via-amber-600 to-blue-500" />
                                </AvatarFallback>
                              </Avatar>
                              <p className="text-sm ml-3 select-text cursor-text">
                                {rawMessage.content.map((item, idx) => (
                                  <span key={`${idx}-${item.type}`}>
                                    {item.type === "text" ? (
                                      item.value
                                    ) : (
                                      <div className="inline-flex items-center rounded-md border bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">
                                        {item.icon === "database-icon" ? (
                                          <PostgresIcon className="mr-1 size-3 text-primary" />
                                        ) : item.icon === "number-icon" ? (
                                          <HashIcon className="mr-1 size-3 text-primary" />
                                        ) : item.icon === "text-icon" ? (
                                          <TextIcon className="mr-1 size-3 text-primary" />
                                        ) : item.icon === "value-icon" ? (
                                          <VariableIcon className="mr-1 size-3 text-primary" />
                                        ) : item.icon ===
                                          "database-column-icon" ? (
                                          <ColumnsIcon className="mr-1 size-3 text-primary" />
                                        ) : item.icon ===
                                          "database-table-icon" ? (
                                          <TableIcon className="mr-1 size-3 text-primary" />
                                        ) : (
                                          <></>
                                        )}
                                        {item.name}
                                      </div>
                                    )}
                                  </span>
                                ))}
                              </p>
                            </div>
                          ) : (
                            <div
                              className="flex items-start"
                              key={rawMessage.content as string}
                              ref={
                                idx === messages.length - 1
                                  ? lastMessageRef
                                  : null
                              }
                            >
                              <Avatar className="size-6 rounded-md">
                                <AvatarImage src="/logo.svg" alt="User" />
                              </Avatar>
                              <p className="text-sm ml-3 select-text cursor-text">
                                {rawMessage.content as string}
                              </p>
                            </div>
                          )}
                        </>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="mt-auto">
                    <form
                      className="relative"
                      onSubmit={async (e) => {
                        e.preventDefault();

                        const editor = editorRef.current;

                        if (editor !== null) {
                          editor.update(() => {
                            const root = $getRoot();
                            root.clear();
                          });
                        }

                        if (!chatMessage) {
                          return;
                        }

                        const newMessages: CoreMessage[] = [
                          ...messages,
                          {
                            role: "user",
                            content: chatMessage,
                          },
                        ];

                        const newRawMessages: (
                          | {
                              role: "user";
                              content: RawDescription[];
                            }
                          | {
                              role: "assistant";
                              content: string;
                            }
                        )[] = [
                          ...rawMessages,
                          {
                            role: "user",
                            content: rawChatMessage,
                          },
                        ];

                        setMessages(newMessages);
                        setRawMessages(newRawMessages);

                        const result =
                          await gatherFunctionRequirements(newMessages);

                        for await (const content of readStreamableValue(
                          result,
                        )) {
                          if ((content as string).trim().endsWith("END")) {
                            console.log("END");
                            break;
                          }
                          setRawMessages([
                            ...newRawMessages,
                            {
                              role: "assistant",
                              content: content as string,
                            },
                          ]);
                          setMessages([
                            ...newMessages,
                            {
                              role: "assistant",
                              content: content as string,
                            },
                          ]);
                        }

                        setChatMessage(null);
                        setRawChatMessage([]);
                      }}
                    >
                      <Editor
                        editorRef={editorRef}
                        id={data.id}
                        inputs={[]}
                        rawMessage={rawChatMessage}
                        placeholder="Create, refine, or fix your function with AI..."
                        onChange={onChatChange}
                      />
                      <Button
                        type="submit"
                        disabled={!chatMessage}
                        size="icon"
                        className="absolute bottom-2 right-2"
                      >
                        <ArrowUpIcon className="size-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={35} minSize={20} className="p-4">
                <Tabs
                  defaultValue="summary"
                  className="flex size-full flex-col space-y-4"
                >
                  <TabsList className="w-full justify-start bg-accent">
                    <TabsTrigger className="w-full" value="summary">
                      Summary
                    </TabsTrigger>
                    <TabsTrigger className="w-full" value="result">
                      Result
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="summary"
                    className="size-full rounded-md bg-background"
                  >
                    <div className="flex size-full items-center justify-center px-6 text-muted-foreground">
                      Summary
                    </div>
                  </TabsContent>
                  <TabsContent
                    value="result"
                    className="size-full rounded-md bg-background"
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
                </Tabs>
              </ResizablePanel>
            </ResizablePanelGroup>
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
