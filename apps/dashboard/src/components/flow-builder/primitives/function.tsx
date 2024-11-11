"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
  FormMessage,
} from "@integramind/ui/form";
import { Input } from "@integramind/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@integramind/ui/resizable";
import { ScrollArea } from "@integramind/ui/scroll-area";
import { cn } from "@integramind/ui/utils";
import {
  Handle,
  Position,
  useHandleConnections,
  useReactFlow,
} from "@xyflow/react";
import type { EditorState, LexicalEditor, ParagraphNode } from "lexical";
import { $getRoot } from "lexical";
import {
  CircleAlertIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FunctionSquareIcon,
  PlayCircleIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type {
  AssistantMessageRawContent,
  ConversationMessage,
  FlatInputSchema,
  FunctionPrimitive,
  FunctionRequirementsMessage,
  InputSchema,
  JsonSchema,
  UserMessageRawContent,
} from "@integramind/shared/types";
import { userMessageRawContentReferenceElementSchema } from "@integramind/shared/validators/conversations";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import { TreeView } from "@integramind/ui/tree-view";
import { readStreamableValue } from "ai/rsc";
import { debounce } from "perfect-debounce";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import Editor from "~/components/editor";
import { TestInputDialog } from "~/components/test-input-dialog";
import { executeFunction } from "~/lib/actions/execute";
import { generateFunction } from "~/lib/ai/generator";
import { api } from "~/lib/trpc/react";
import {
  flattenInputSchema,
  jsonSchemaToTreeData,
  rawMessageContentToText,
} from "~/lib/utils";
import type { FlowEdge, FlowNode, FlowNodeProps } from "~/types";
import type { ReferenceNode } from "../../editor/nodes/reference-node";
import MessageList from "../../message-list";
import { RawContentViewer } from "../../raw-content-viewer";
import { PrimitiveDropdownMenu } from "./primitive-dropdown-menu";

const validationSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required",
    })
    .regex(/^\S*$/, {
      message: "Cannot contain spaces.",
    })
    .transform((name) => name.trim()),
});

export const FunctionNode = memo(
  ({
    data: _data,
    selected,
    positionAbsoluteX,
    positionAbsoluteY,
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

    const addMessage = api.conversations.addMessage.useMutation();

    const editorRef = useRef<LexicalEditor>(null);

    const { deleteElements, fitBounds, getNode } = useReactFlow<
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
      if (!ancestor.data.metadata?.inputSchema) {
        return acc;
      }

      const flatInputSchema = flattenInputSchema({
        schema: ancestor.data.metadata?.inputSchema,
      });

      return acc.concat(flatInputSchema);
    }, [] as FlatInputSchema[]);

    const inputSchema = data.flow?.inputSchema
      ? [...passedInputs].concat(
          flattenInputSchema({
            schema: data.flow.inputSchema,
          }),
        )
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

    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);
    const [isRunning, setIsRunning] = useState<boolean>(false);
    const [testInput, setTestInput] = useState<unknown>(
      data.metadata?.testInput ?? {},
    );

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
      },
      ...(data.conversation?.messages ?? []).sort(
        (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
      ),
    ]);
    const [userMessageContent, setUserMessageContent] = useState<string | null>(
      null,
    );
    const [userMessageRawContent, setUserMessageRawContent] =
      useState<UserMessageRawContent>([]);

    function onChatChange(editorState: EditorState) {
      editorState.read(async () => {
        const root = $getRoot();
        const children = (
          root.getChildren()[0] as ParagraphNode
        )?.getChildren();
        const chat = root.getTextContent();
        console.log(chat);
        const userMessageRawContent = children?.reduce((acc, child) => {
          if (child.__type === "text") {
            acc.push({
              type: "text",
              value: child.getTextContent(),
            });
          }

          if (child.__type === "reference") {
            const referenceNode = child as ReferenceNode;
            acc.push(
              userMessageRawContentReferenceElementSchema.parse(
                referenceNode.__reference,
              ),
            );
          }

          return acc;
        }, [] as UserMessageRawContent);

        setUserMessageContent(chat);
        setUserMessageRawContent(userMessageRawContent);
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

    const handleOnSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      setIsGenerating(true);

      const editor = editorRef.current;

      if (editor !== null) {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
        });
      }

      if (!userMessageContent) {
        return;
      }

      const newMessageUser: ConversationMessage & {
        conversationId: string;
      } = {
        role: "user",
        content: userMessageContent,
        rawContent: userMessageRawContent,
        conversationId: data.conversation.id,
        createdAt: new Date(),
      };

      const newMessages = [...messages, newMessageUser];

      setMessages(newMessages);

      await addMessage.mutateAsync(newMessageUser);

      const result = await generateFunction({
        functionId: data.id,
        conversationId: data.conversation.id,
        messages: newMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });

      let newAssistantMessageStr = "";
      let newAssistantMessage: ConversationMessage | null = null;

      for await (const content of readStreamableValue(result)) {
        newAssistantMessage = {
          role: "assistant",
          content: "",
          rawContent: [],
          createdAt: new Date(),
        };

        if (content?.message?.content && content.message.type === "message") {
          newAssistantMessage.content = rawMessageContentToText(
            content.message.content,
          );
          newAssistantMessage.rawContent = content.message.content;
        }

        // if end message, start generating code
        if (
          content?.message?.type === "end" &&
          content?.message?.content?.description
        ) {
          setIsGeneratingCode(true);
          const rawContent: AssistantMessageRawContent = [
            {
              type: "text",
              value: "Generating the following function: ",
            },
            ...content.message.content.description,
          ];
          newAssistantMessage.content = rawMessageContentToText(rawContent);
          newAssistantMessage.rawContent = rawContent;
        }

        if (newAssistantMessage) {
          setMessages([...newMessages, newAssistantMessage]);
        }
        newAssistantMessageStr = JSON.stringify(content);
      }

      // add the last message to the new messages temporary list
      if (newAssistantMessage) {
        newMessages.push(newAssistantMessage);
      }

      const functionRequirementsMessageObject = JSON.parse(
        newAssistantMessageStr,
      ) as FunctionRequirementsMessage;

      // if code generation is set, disable it and refetch the updated function metadata
      if (functionRequirementsMessageObject.message.type === "end") {
        setIsGeneratingCode(false);
        const functionBuiltSuccessfullyMessage: ConversationMessage = {
          role: "assistant",
          rawContent: [
            {
              type: "text",
              value: "Your function has been built successfully!",
            },
          ],
          content: "Your function has been built successfully!",
          createdAt: new Date(),
        };

        await refetch();
        setMessages([...newMessages, functionBuiltSuccessfullyMessage]);
      }

      setUserMessageContent(null);
      setUserMessageRawContent([]);
      setIsGenerating(false);
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
                      <FunctionSquareIcon className="size-4 text-primary" />
                      <span className="text-muted-foreground">Function</span>
                    </div>
                    {(!data.name || !data.metadata?.description) && (
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
                      <FunctionSquareIcon className="size-4 text-primary" />
                      <span className="text-muted-foreground">Function</span>
                    </div>
                    <div className="flex items-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="size-7 text-success hover:text-success"
                            variant="ghost"
                            size="icon"
                            disabled={
                              !data.metadata?.rawDescription ||
                              !data.name ||
                              isRunning
                            }
                            onClick={async () => {
                              setIsRunning(true);
                              await executeFunction({
                                functionId: data.id,
                                input:
                                  Object.keys(testInput ?? {}).length > 0
                                    ? (testInput as Record<string, unknown>)
                                    : undefined,
                              });
                              setIsRunning(false);
                              await refetch();
                            }}
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
                  <ScrollArea
                    className="flex-grow w-full mb-2"
                    ref={scrollAreaRef}
                  >
                    <MessageList
                      messages={messages}
                      testRuns={data.testRuns}
                      isRunning={isRunning}
                      isGenerating={isGeneratingCode}
                      chatHistoryEndRef={chatHistoryEndRef}
                    />
                  </ScrollArea>
                  <div className="mt-auto">
                    <form className="relative" onSubmit={handleOnSubmit}>
                      <Editor
                        editorRef={editorRef}
                        id={data.id}
                        inputSchema={inputSchema}
                        rawMessage={userMessageRawContent}
                        placeholder="Create, refine, or fix your function with Specly..."
                        onChange={onChatChange}
                      />
                      <Button
                        type="submit"
                        disabled={!userMessageContent || isGenerating}
                        size="sm"
                        className="absolute bottom-2 right-2 disabled:bg-muted-foreground"
                      >
                        Send
                        <span className="ml-1">
                          <span className="px-1 py-0.5 bg-white/20 rounded-sm disabled:text-muted-foreground">
                            {typeof window !== "undefined" &&
                            window.navigator?.userAgent
                              .toLowerCase()
                              .includes("mac")
                              ? "⌘"
                              : "Ctrl"}
                            ⏎
                          </span>
                        </span>
                      </Button>
                    </form>
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={35} minSize={20} className="p-4">
                {data.metadata?.rawDescription ? (
                  <ScrollArea className="size-full">
                    <div className="max-h-[500px] space-y-2">
                      <div className="space-y-1">
                        <span className="text-sm select-text cursor-text font-semibold text-muted-foreground">
                          Description:
                        </span>
                        <RawContentViewer
                          rawContent={data.metadata?.rawDescription ?? []}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between pr-2">
                          <span className="text-sm select-text cursor-text font-semibold text-muted-foreground">
                            Input:
                          </span>
                          <TestInputDialog
                            schema={data.metadata?.inputSchema as JsonSchema}
                            formData={testInput}
                            setFormData={setTestInput}
                            onSubmit={async () => {
                              await updateFunction.mutateAsync({
                                where: {
                                  id: data.id,
                                },
                                payload: {
                                  type: "function",
                                  metadata: {
                                    testInput,
                                  },
                                },
                              });
                            }}
                          />
                        </div>
                        <TreeView
                          data={jsonSchemaToTreeData(
                            data.metadata?.inputSchema as JsonSchema,
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-sm select-text cursor-text font-semibold text-muted-foreground">
                          Output:
                        </span>
                        <TreeView
                          data={jsonSchemaToTreeData(
                            data.metadata?.outputSchema as JsonSchema,
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-sm select-text cursor-text font-semibold text-muted-foreground">
                          Logical Steps:
                        </span>
                        <p className="text-sm select-text cursor-text">
                          <RawContentViewer
                            rawContent={data.metadata?.logicalSteps ?? []}
                          />
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-sm select-text cursor-text font-semibold text-muted-foreground">
                          Edge Cases:
                        </span>
                        <p className="text-sm select-text cursor-text">
                          {data.metadata?.edgeCases}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-sm select-text cursor-text font-semibold text-muted-foreground">
                          Error Handling:
                        </span>
                        <p className="text-sm select-text cursor-text">
                          {data.metadata?.errorHandling}
                        </p>
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-sm text-muted-foreground">
                      Function is not implemented yet. Chat with Specly to build
                      it.
                    </span>
                  </div>
                )}
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
