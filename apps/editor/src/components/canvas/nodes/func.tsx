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
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { EditorState, LexicalEditor, ParagraphNode } from "lexical";
import { $getRoot } from "lexical";
import {
  CircleAlertIcon,
  EllipsisVerticalIcon,
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

import type { RouterOutputs } from "@integramind/api";
import type {
  AssistantMessageRawContent,
  ConversationMessage,
  FuncRequirementsMessage,
  JsonSchema,
  UserMessageRawContent,
} from "@integramind/shared/types";
import { userMessageRawContentReferenceElementSchema } from "@integramind/shared/validators/conversations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import { TreeView } from "@integramind/ui/tree-view";
import { createId } from "@paralleldrive/cuid2";
import { type StreamableValue, readStreamableValue } from "ai/rsc";
import { debounce } from "perfect-debounce";
import ReactMarkdown from "react-markdown";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { Editor } from "~/components/editor";
import { TestInputDialog } from "~/components/test-input-dialog";
import { generateFunc } from "~/lib/ai/generator";
import { useResources } from "~/lib/context/resources";
import { useFlowBuilderStore } from "~/lib/store";
import { api } from "~/lib/trpc/client";
import { getResourceReferences, jsonSchemaToTreeData } from "~/lib/utils";
import type { CanvasNode, CanvasNodeProps } from "~/types";
import type { ReferenceNode } from "../../editor/plugins/reference/node";
import MessageList from "../../message-list";
import { RawContentViewer } from "../../raw-content-viewer";

const validationSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required",
    })
    .regex(/^[a-z]/, {
      message: "Name must start with a small letter",
    })
    .regex(/^[a-z][a-zA-Z0-9]*$/, {
      message: "Can only contain letters and numbers",
    }),
});

export const FuncNode = memo(
  ({
    data: _data,
    selected,
    positionAbsoluteX,
    positionAbsoluteY,
  }: CanvasNodeProps) => {
    const { data: fetchedData } = api.funcs.byId.useQuery(
      {
        id: _data.id,
      },
      {
        initialData: _data as RouterOutputs["funcs"]["byId"],
      },
    );

    const data = fetchedData;

    const { data: testRuns } = api.testRuns.listByFuncId.useQuery(
      {
        funcId: data.id,
      },
      {
        initialData: data.testRuns ?? [],
      },
    );

    const { deleteElements, fitBounds, updateNodeData } =
      useReactFlow<CanvasNode>();

    const apiUtils = api.useUtils();

    const updateFunc = api.funcs.update.useMutation({
      onSuccess: async () => {
        await apiUtils.funcs.byId.invalidate({ id: data.id });
        updateNodeData(data.id, data);
      },
    });

    const executeFunc = api.engine.executeFunc.useMutation({
      onSuccess: async () => {
        await apiUtils.funcs.byId.invalidate({ id: data.id });
        await apiUtils.testRuns.listByFuncId.invalidate({
          funcId: data.id,
        });
      },
    });

    const deleteFunc = api.funcs.delete.useMutation({
      onSuccess: async () => {
        await apiUtils.modules.byId.invalidate({ id: data.moduleId });
      },
    });

    const addMessage = api.conversations.addMessage.useMutation();

    const editorRef = useRef<LexicalEditor>(null);

    const form = useForm<z.infer<typeof validationSchema>>({
      mode: "onChange",
      resolver: zodResolver(validationSchema),
      defaultValues: {
        name: data.name ?? "",
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

    const showEdges = useFlowBuilderStore((state) => state.showEdges);
    const [isThinking, setIsThinking] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);
    const [isRunning, setIsRunning] = useState<boolean>(false);
    const [testInput, setTestInput] = useState<unknown>(data.testInput ?? {});

    const conversation: ConversationMessage[] = useMemo(
      () => [
        {
          id: createId(),
          role: "assistant",
          content:
            "Hi there! I'm Integrator, your AI assistant. What does your function do?",
          rawContent: [
            {
              type: "text",
              value:
                "Hi there! I'm Integrator, your AI assistant. What does your function do?",
            },
          ],
        },
        ...(data.conversation?.messages ?? []).sort(
          (a, b) =>
            (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
        ),
      ],
      [data.conversation],
    );

    const [messages, setMessages] =
      useState<ConversationMessage[]>(conversation);
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
        const text = root.getTextContent();

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

        setUserMessageRawContent(userMessageRawContent);
        setUserMessageContent(text);
      });
    }

    const chatHistoryEndRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

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

    const handleOnSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
      if (e) {
        e.preventDefault();
      }

      if (!data.conversationId) {
        return;
      }

      setIsThinking(true);
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
        rawContent: userMessageRawContent,
        conversationId: data.conversationId,
        createdAt: new Date(),
      };

      const newMessages = [...messages, newMessageUser];

      setMessages(newMessages);

      await addMessage.mutateAsync({
        role: "user",
        rawContent: userMessageRawContent,
        conversationId: data.conversationId,
        funcId: data.id,
      });

      const result = await generateFunc({
        funcId: data.id,
        conversationId: data.conversationId,
      });

      if (
        typeof result === "object" &&
        "status" in result &&
        result.status === "error"
      ) {
        setIsGenerating(false);
        return;
      }

      let newAssistantMessageStr = "";
      let newAssistantMessage: ConversationMessage | null = null;

      for await (const content of readStreamableValue(
        result as StreamableValue<FuncRequirementsMessage>,
      )) {
        newAssistantMessage = {
          role: "assistant",
          rawContent: [],
          createdAt: new Date(),
        };

        if (content?.message?.content && content.message.type === "message") {
          setIsThinking(false);
          newAssistantMessage.rawContent = content.message.content;
        }

        // if end message, start generating code
        if (
          content?.message?.type === "end" &&
          content?.message?.content?.description
        ) {
          setIsThinking(false);
          setIsGeneratingCode(true);
          const rawContent: AssistantMessageRawContent = [
            {
              type: "text",
              value: "Generating the following function: ",
            },
            ...content.message.content.description,
          ];
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

      const funcRequirementsMessageObject = JSON.parse(
        newAssistantMessageStr,
      ) as FuncRequirementsMessage;

      // if code generation is set, disable it and refetch the updated function metadata
      if (funcRequirementsMessageObject.message.type === "end") {
        setIsGeneratingCode(false);
        const funcBuiltSuccessfullyMessage: ConversationMessage = {
          role: "assistant",
          rawContent: [
            {
              type: "text",
              value: "Your function has been built successfully!",
            },
          ],
          createdAt: new Date(),
        };

        await apiUtils.modules.byId.invalidate({ id: data.moduleId });
        await apiUtils.funcs.byId.invalidate({ id: data.id });
        await apiUtils.funcDependencies.available.invalidate();
        setMessages([...newMessages, funcBuiltSuccessfullyMessage]);
      }

      setUserMessageContent(null);
      setUserMessageRawContent([]);
      setIsGenerating(false);
    };

    const resources = useResources();
    const availableHelperFunctions = api.funcDependencies.available.useQuery({
      funcId: data.id,
    });

    const helperFunctionReferences = availableHelperFunctions.data?.reduce(
      (acc, func) => {
        if (
          !func.name ||
          !func.rawDescription ||
          !func.behavior ||
          !func.errors ||
          !func.module.name
        ) {
          return acc;
        }

        acc.push({
          type: "reference",
          referenceType: "function",
          id: func.id,
          name:
            data.moduleId === func.module.id
              ? func.name
              : `${func.module.name}.${func.name}`,
          moduleName: func.module.name,
        });

        return acc;
      },
      [] as z.infer<typeof userMessageRawContentReferenceElementSchema>[],
    );

    const references: z.infer<
      typeof userMessageRawContentReferenceElementSchema
    >[] = useMemo(
      () => [
        ...getResourceReferences(resources),
        ...(helperFunctionReferences ?? []),
      ],
      [resources, helperFunctionReferences],
    );

    const debouncedUpdate = useMemo(
      () =>
        debounce(
          async (values: z.infer<typeof validationSchema>) => {
            await updateFunc.mutateAsync({
              where: {
                id: data.id,
              },
              payload: {
                name: values.name,
              },
            });
          },
          500,
          { trailing: false },
        ),
      [data.id, updateFunc],
    );

    const onFormChange = (values: z.infer<typeof validationSchema>) => {
      debouncedUpdate(values);
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
                    {
                      "border-primary": selected,
                    },
                  )}
                  onClick={() => {
                    fitBounds(
                      {
                        x: positionAbsoluteX,
                        y: positionAbsoluteY - 100,
                        width: 200,
                        height: 800,
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
                    {!data.canRun && (
                      <CircleAlertIcon className="size-4 text-destructive" />
                    )}
                  </div>
                  <span className="text-sm">{data.name ?? "newFunction"}</span>
                </Card>
              </ExpandableCardTrigger>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuLabel className="text-xs">Function</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem className="flex items-center justify-between text-xs">
                <Link
                  className="flex items-center"
                  href="https://docs.integramind.ai/functions"
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
          <ExpandableCardContent className="nowheel flex h-[600px] w-[60vw] flex-col -left-[calc(60vw-650px)]">
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
                              !data.rawDescription ||
                              !data.name ||
                              isRunning ||
                              (data.inputSchema && !data.testInput) === true
                            }
                            onClick={async () => {
                              setIsRunning(true);
                              await executeFunc.mutateAsync({
                                funcId: data.id,
                                input: data.testInput
                                  ? (data.testInput as Record<string, unknown>)
                                  : undefined,
                              });
                              setIsRunning(false);
                            }}
                          >
                            <PlayCircleIcon className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-muted border">
                          <span className="text-success">Run</span>
                        </TooltipContent>
                      </Tooltip>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
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
                            Run with previous functions
                          </DropdownMenuItem>
                          <DropdownMenuItem className="flex items-center justify-between text-xs">
                            <Link
                              className="flex items-center"
                              href="https://docs.integramind.ai/functions"
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
                  <Form {...form}>
                    <form onChange={form.handleSubmit(onFormChange)}>
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="space-y-0">
                            <FormControl>
                              <Input
                                {...field}
                                autoComplete="off"
                                className="h-8 border-none shadow-none dark:bg-muted p-0 text-base focus-visible:ring-0"
                                placeholder="Enter function name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </form>
                  </Form>
                </ExpandableCardHeader>
                <div className="flex flex-col h-[calc(100dvh-492px)] p-4">
                  <ScrollArea
                    className="flex-grow w-full mb-2"
                    ref={scrollAreaRef}
                  >
                    <MessageList
                      messages={messages}
                      testRuns={testRuns}
                      isThinking={isThinking}
                      isRunning={isRunning}
                      isGenerating={isGeneratingCode}
                    />
                    <div ref={chatHistoryEndRef} />
                  </ScrollArea>
                  <div className="mt-auto">
                    <form className="relative" onSubmit={handleOnSubmit}>
                      <Editor
                        id={data.id}
                        editorRef={editorRef}
                        references={references}
                        rawMessage={userMessageRawContent}
                        placeholder="Create, refine, or fix your function with Integrator..."
                        onChange={onChatChange}
                        onSubmit={async () => {
                          if (
                            userMessageContent &&
                            !isGenerating &&
                            data.name
                          ) {
                            await handleOnSubmit();
                          }
                        }}
                      />
                      <Button
                        type="submit"
                        disabled={
                          !userMessageContent || isGenerating || !data.name
                        }
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
                {data.rawDescription ? (
                  <ScrollArea className="size-full">
                    <div className="max-h-[500px] space-y-2">
                      <div className="flex flex-col space-y-1">
                        <span className="text-sm select-text cursor-text font-semibold text-muted-foreground">
                          Description:
                        </span>
                        <RawContentViewer
                          rawContent={data.rawDescription ?? []}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between pr-2">
                          <span className="text-sm select-text cursor-text font-semibold text-muted-foreground">
                            Input:
                          </span>
                          <TestInputDialog
                            schema={data.inputSchema as JsonSchema}
                            formData={testInput}
                            setFormData={setTestInput}
                            onSubmit={async () => {
                              await updateFunc.mutateAsync({
                                where: {
                                  id: data.id,
                                },
                                payload: {
                                  testInput,
                                },
                              });
                            }}
                          />
                        </div>
                        <TreeView
                          data={jsonSchemaToTreeData(
                            data.inputSchema ?? undefined,
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-sm select-text cursor-text font-semibold text-muted-foreground">
                          Output:
                        </span>
                        <TreeView
                          data={jsonSchemaToTreeData(
                            data.outputSchema ?? undefined,
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-sm select-text cursor-text font-semibold text-muted-foreground">
                          Behavior:
                        </span>
                        <div className="prose select-text cursor-text text-sm prose-ol:marker:text-foreground prose-code:text-primary text-foreground prose-ul:my-0 prose-ol:my-0 prose-li:my-0 [&_ol]:marker:text-foreground [&_ol]:text-foreground">
                          <RawContentViewer rawContent={data.behavior ?? []} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-sm select-text cursor-text font-semibold text-muted-foreground">
                          Errors:
                        </span>
                        <div className="prose select-text cursor-text text-sm prose-code:text-primary text-foreground prose-ul:my-0 prose-ol:my-0 prose-li:my-0">
                          <ReactMarkdown
                            components={{
                              code: ({ children }) => (
                                <span className="inline-flex items-center rounded-md border bg-accent px-1.5 py-0.5 text-xs text-destructive">
                                  {children}
                                </span>
                              ),
                            }}
                          >
                            {data.errors}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-sm text-muted-foreground">
                      Function is not implemented yet. Chat with Integrator to
                      build it.
                    </span>
                  </div>
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          </ExpandableCardContent>
        </ExpandableCard>
        <Handle
          className={cn(
            "border rounded-full bg-background p-1",
            showEdges ? "" : "opacity-0",
          )}
          type="target"
          position={Position.Left}
          isConnectable={false}
        />
        <Handle
          className={cn(
            "border rounded-full bg-background p-1",
            showEdges ? "" : "opacity-0",
          )}
          type="source"
          position={Position.Right}
          isConnectable={false}
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
            deleteFunc.mutate({
              id: data.id,
            });
          }}
        />
      </>
    );
  },
);
