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
import {
  Handle,
  Position,
  useHandleConnections,
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
  Loader2,
  Loader2Icon,
  LockIcon,
  PlayCircleIcon,
  TrashIcon,
  UnlockIcon,
} from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { createId } from "@paralleldrive/cuid2";
import type {
  ConversationMessage,
  FlatInputSchema,
  FunctionPrimitive,
  FunctionRequirementsMessage,
  InputSchema,
  RawDescription,
} from "@specly/shared/types";
import { rawDescriptionReferenceSchema } from "@specly/shared/validators/common";
import { Avatar, AvatarFallback, AvatarImage } from "@specly/ui/avatar";
import { LambdaIcon } from "@specly/ui/icons/lambda-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@specly/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { readStreamableValue } from "ai/rsc";
import { debounce } from "perfect-debounce";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import Editor from "~/components/editor";
import { gatherFunctionRequirements } from "~/lib/ai/generator";
import { api } from "~/lib/trpc/react";
import { flattenInputSchema, fromRawDescriptionToText } from "~/lib/utils";
import type { FlowEdge, FlowNode, FlowNodeProps } from "~/types";
import type { ReferenceNode } from "../editor/nodes/reference-node";
import { ReferenceBadge } from "../editor/reference-badge";
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
});

export const FunctionNode = memo(
  ({
    data: _data,
    selected,
    positionAbsoluteX,
    positionAbsoluteY,
    parentId,
  }: FlowNodeProps) => {
    const { data: fetchedData, refetch } = api.primitives.getById.useQuery(
      {
        id: _data.id,
      },
      {
        initialData: _data,
      },
    );

    const data = fetchedData as FunctionPrimitive & {
      flow: { inputSchema: InputSchema | undefined };
    };

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

    const addMessage = api.conversations.addMessage.useMutation();

    const editorRef = useRef<LexicalEditor>(null);

    const { deleteElements, updateNodeData, fitBounds, getNode } = useReactFlow<
      FlowNode,
      FlowEdge
    >();

    const connections = useHandleConnections({
      type: "target",
      nodeId: _data.id,
    });

    const ancestors = useMemo(() => {
      return connections.reduce((acc, connection) => {
        const ancestor = getNode(connection.source);
        if (ancestor) {
          acc.push(ancestor);
        }
        return acc;
      }, [] as FlowNode[]);
    }, [connections, getNode]);

    const passedInputs = ancestors.reduce((acc, ancestor) => {
      if (!ancestor.data.metadata.inputSchema) {
        return acc;
      }

      const flatInputSchema = flattenInputSchema(
        ancestor.data.metadata.inputSchema,
      );

      return acc.concat(flatInputSchema);
    }, [] as FlatInputSchema[]);

    const inputs = data.flow?.inputSchema
      ? [...passedInputs].concat(flattenInputSchema(data.flow.inputSchema))
      : [...passedInputs];

    const form = useForm<z.infer<typeof validationSchema>>({
      mode: "all",
      criteriaMode: "all",
      reValidateMode: "onChange",
      resolver: zodResolver(validationSchema),
      defaultValues: {
        name: data.name ?? undefined,
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

    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);

    const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);
    const [messages, setMessages] = useState<ConversationMessage[]>([
      {
        role: "assistant",
        content:
          "Hi there! I'm Specly, your AI assistant. What does your function do?",
        rawContent: [
          {
            type: "text",
            value:
              "Hi there! I'm Specly, your AI assistant. What does your function do?",
          },
        ],
        conversationId: data.conversation.id,
      },
      ...(data.conversation.messages.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      ) as ConversationMessage[]),
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
            acc.push(
              rawDescriptionReferenceSchema.parse(referenceNode.__reference),
            );
          }

          return acc;
        }, [] as RawDescription[]);

        console.log(rawDescription);

        setChatMessage(chat);
        setRawChatMessage(rawDescription);
      });
    }

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const chatHistoryEndRef = useRef<HTMLDivElement>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    const scrollToBottom = useCallback(() => {
      if (chatHistoryEndRef.current && scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector(
          "[data-radix-scroll-area-viewport]",
        );
        if (scrollContainer) {
          const lastMessageRect =
            chatHistoryEndRef.current.getBoundingClientRect();
          const scrollContainerRect = scrollContainer.getBoundingClientRect();
          const offset =
            lastMessageRect.bottom - scrollContainerRect.bottom + 16;

          if (offset > 0) {
            scrollContainer.scrollTop += offset;
          }
        }
      }
    }, [messages]);

    useEffect(() => {
      scrollToBottom();
    }, [scrollToBottom]);

    const handleOnDetach = async () => {
      if (parentId) {
        updateNodeData(data.id, {
          parentId: null,
        });
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
    };

    const handleOnSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

      const newMessageUser: ConversationMessage = {
        role: "user",
        content: chatMessage,
        rawContent: rawChatMessage,
        conversationId: data.conversation.id,
      };

      const newMessages = [...messages, newMessageUser];

      setMessages(newMessages);

      await addMessage.mutateAsync(newMessageUser);

      const result = await gatherFunctionRequirements({
        functionId: data.id,
        conversationId: data.conversation.id,
        messages: newMessages.map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content as string,
        })),
      });

      let functionRequirementsMessage = "";
      let newMessageAssistant: ConversationMessage | null = null;

      for await (const content of readStreamableValue(result)) {
        newMessageAssistant = {
          role: "assistant",
          content: "",
          rawContent: [],
          conversationId: data.conversation.id,
        };

        if (content?.message?.content && content.message.type === "message") {
          newMessageAssistant.content = fromRawDescriptionToText(
            content.message.content,
          );
          newMessageAssistant.rawContent = content.message.content;
        }

        // if end message, start generating code
        if (
          content?.message?.type === "end" &&
          content?.message?.content?.description
        ) {
          const description: RawDescription[] = [
            {
              type: "text",
              value: "Generating the following function: ",
            },
            ...content.message.content.description,
          ];
          newMessageAssistant.content = fromRawDescriptionToText(description);
          newMessageAssistant.rawContent = description;
        }

        if (newMessageAssistant) {
          setMessages([...newMessages, newMessageAssistant]);
        }
        functionRequirementsMessage = JSON.stringify(content);
      }

      // add the last message to the new messages temporary list
      if (newMessageAssistant) {
        newMessages.push(newMessageAssistant);
      }

      const functionRequirementsMessageObject = JSON.parse(
        functionRequirementsMessage,
      ) as FunctionRequirementsMessage;

      // if code generation is set, disable it and refetch the updated function metadata
      if (functionRequirementsMessageObject.message.type === "end") {
        setIsGeneratingCode(true);

        const functionBuiltSuccessfullyMessage: ConversationMessage = {
          role: "assistant",
          rawContent: [
            {
              type: "text",
              value: "Your function has been built successfully!",
            },
          ],
          content: "Your function has been built successfully!",
          conversationId: data.conversation.id,
        };

        setIsGeneratingCode(false);
        setMessages([...newMessages, functionBuiltSuccessfullyMessage]);
      }

      setChatMessage(null);
      setRawChatMessage([]);
    };

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
                <ContextMenuItem className="text-xs" onClick={handleOnDetach}>
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
                      {messages.map((messages) => (
                        <div
                          className="flex items-start"
                          key={messages.id ?? createId()}
                        >
                          <Avatar className="size-6 rounded-md">
                            {messages.role === "user" ? (
                              <>
                                <AvatarImage src={undefined} alt="User" />
                                <AvatarFallback>
                                  <div className="size-full bg-gradient-to-br from-rose-500 via-amber-600 to-blue-500" />
                                </AvatarFallback>
                              </>
                            ) : (
                              <AvatarImage src="/logo.svg" alt="Specly" />
                            )}
                          </Avatar>
                          <p className="text-sm ml-3 select-text cursor-text">
                            {messages.rawContent?.map((item, idx) => (
                              <span
                                key={`${idx}-${item.type}`}
                                className={cn({
                                  "text-success":
                                    item.type === "text" &&
                                    item.value ===
                                      "Your function has been built successfully!",
                                })}
                              >
                                {item.type === "text" ? (
                                  item.value
                                ) : (
                                  <ReferenceBadge reference={item} />
                                )}
                              </span>
                            ))}
                          </p>
                        </div>
                      ))}
                      {isGeneratingCode && (
                        <div className="flex items-center justify-center">
                          <Loader2 className="size-4 animate-spin" />
                        </div>
                      )}
                      <div ref={chatHistoryEndRef} />
                    </div>
                  </ScrollArea>
                  <div className="mt-auto">
                    <form className="relative" onSubmit={handleOnSubmit}>
                      <Editor
                        editorRef={editorRef}
                        id={data.id}
                        inputSchema={inputs}
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
