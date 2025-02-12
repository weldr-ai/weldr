import { Button } from "@weldr/ui/button";
import { Card } from "@weldr/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@weldr/ui/context-menu";
import {
  ExpandableCard,
  ExpandableCardContent,
  ExpandableCardHeader,
  ExpandableCardTrigger,
} from "@weldr/ui/expandable-card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@weldr/ui/resizable";
import { ScrollArea } from "@weldr/ui/scroll-area";
import { cn } from "@weldr/ui/utils";
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

import { DeleteAlertDialog } from "@/components/delete-alert-dialog";
import { Editor } from "@/components/editor";
import { TestInputDialog } from "@/components/test-input-dialog";
import { generateFunc } from "@/lib/ai/generator";
import { useResources } from "@/lib/context/resources";
import { useFlowBuilder } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import { getResourceReferences } from "@/lib/utils";
import type { CanvasNode, CanvasNodeProps } from "@/types";
import type { RouterOutputs } from "@weldr/api";
import type {
  ChatMessage,
  FuncRequirementsMessage,
  JsonSchema,
  UserMessageRawContent,
} from "@weldr/shared/types";
import { toTitle } from "@weldr/shared/utils";
import { userMessageRawContentReferenceElementSchema } from "@weldr/shared/validators/chats";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@weldr/ui/dropdown-menu";
import { toast } from "@weldr/ui/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@weldr/ui/tooltip";
import { TreeView, schemaToTreeData } from "@weldr/ui/tree-view";
import { type StreamableValue, readStreamableValue } from "ai/rsc";
import ReactMarkdown from "react-markdown";
import type { z } from "zod";
import type { ReferenceNode } from "../../editor/plugins/reference/node";
import MessageList from "../../message-list";
import { RawContentViewer } from "../../raw-content-viewer";

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

    const { deleteElements, fitBounds, updateNodeData } =
      useReactFlow<CanvasNode>();

    const apiUtils = api.useUtils();

    const updateFunc = api.funcs.update.useMutation({
      onSuccess: async (data) => {
        updateNodeData(data.id, data);
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });

    const executeFunc = api.engine.executeFunc.useMutation({
      onSuccess: async () => {
        await apiUtils.funcs.byId.invalidate({ id: data.id });
      },
    });

    const deleteFunc = api.funcs.delete.useMutation();

    const addMessage = api.chats.addMessage.useMutation();

    const editorRef = useRef<LexicalEditor>(null);

    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);

    const { showEdges } = useFlowBuilder();
    const [isThinking, setIsThinking] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isBuilding, setIsBuilding] = useState<boolean>(false);
    const [isRunning, setIsRunning] = useState<boolean>(false);
    const [testInput, setTestInput] = useState<unknown>(data.testInput ?? {});

    const [messages, setMessages] = useState<ChatMessage[]>(
      data.chat?.messages ?? [],
    );
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
          if (child.__type === "paragraph") {
            acc.push({
              type: "paragraph",
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

      if (!data.chatId) {
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

      const newMessageUser: ChatMessage = {
        role: "user",
        rawContent: userMessageRawContent,
        chatId: data.chatId,
        createdAt: new Date(),
      };

      const newMessages = [...messages, newMessageUser];

      setMessages(newMessages);

      await addMessage.mutateAsync({
        chatId: data.chatId,
        messages: [
          {
            role: "user",
            rawContent: userMessageRawContent,
            funcId: data.id,
          },
        ],
      });

      const result = await generateFunc(data.id);

      if (
        typeof result === "object" &&
        "status" in result &&
        result.status === "error"
      ) {
        setIsGenerating(false);
        return;
      }

      let newAssistantMessageStr = "";
      let newAssistantMessage: ChatMessage | null = null;

      for await (const content of readStreamableValue(
        result as StreamableValue<FuncRequirementsMessage>,
      )) {
        if (content?.message?.content && content.message.type === "message") {
          setIsThinking(false);
          newAssistantMessage = {
            role: "assistant",
            rawContent: [],
            createdAt: new Date(),
          };
          newAssistantMessage.rawContent = content.message.content;
          setMessages([...newMessages, newAssistantMessage]);
        }

        // if end message, start generating code
        if (
          content?.message?.type === "end" &&
          content?.message?.content?.description
        ) {
          setIsThinking(false);
          setIsBuilding(true);
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
        await apiUtils.funcs.byId.invalidate({ id: data.id });
        // await apiUtils.dependencies.available.invalidate();
        await apiUtils.versions.dependencies.invalidate({
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          projectId: data.projectId!,
        });
      }

      setUserMessageContent(null);
      setUserMessageRawContent([]);
      setIsGenerating(false);
      setIsBuilding(false);
    };

    const resources = useResources();
    const availableHelperFunctions = api.dependencies.available.useQuery({
      dependentType: "function",
      dependentId: data.id,
    });

    const helperFunctionReferences = availableHelperFunctions.data?.reduce(
      (acc, func) => {
        if (!func.currentDefinition?.name) {
          return acc;
        }

        acc.push({
          type: "reference",
          referenceType: "function",
          id: func.id,
          name: func.currentDefinition.name,
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
                        width: 250,
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
                  <span className="w-full truncate text-start text-sm">
                    {data.name ? toTitle(data.name) : "Unimplemented Function"}
                  </span>
                </Card>
              </ExpandableCardTrigger>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuLabel className="text-xs">Function</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem className="flex items-center justify-between text-xs">
                <Link
                  className="flex items-center"
                  href="https://docs.weldr.ai/functions"
                  target="blank"
                >
                  <FileTextIcon className="mr-3 size-4 text-muted-foreground" />
                  Docs
                </Link>
                <ExternalLinkIcon className="size-3 text-muted-foreground" />
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="flex text-destructive text-xs hover:text-destructive focus:text-destructive/90"
                onClick={() => setDeleteAlertDialogOpen(true)}
              >
                <TrashIcon className="mr-3 size-4" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          <ExpandableCardContent className="nowheel -left-[calc(60vw-650px)] flex h-[600px] w-[60vw] flex-col">
            <ResizablePanelGroup
              direction="horizontal"
              className="flex size-full"
            >
              <ResizablePanel
                defaultSize={65}
                minSize={20}
                className="flex flex-col"
              >
                <ExpandableCardHeader className="flex flex-col items-start justify-start gap-1 border-b p-4">
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
                        <TooltipContent className="border bg-muted">
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
                              href="https://docs.weldr.ai/functions"
                              target="blank"
                            >
                              <FileTextIcon className="mr-3 size-4 text-muted-foreground" />
                              Docs
                            </Link>
                            <ExternalLinkIcon className="size-3 text-muted-foreground" />
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="flex text-destructive text-xs hover:text-destructive focus:text-destructive/90"
                            onClick={() => setDeleteAlertDialogOpen(true)}
                          >
                            <TrashIcon className="mr-3 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <h3
                    className={cn("text-sm", {
                      "text-destructive": !data.canRun,
                    })}
                  >
                    {data.name ? toTitle(data.name) : "Unimplemented Function"}
                  </h3>
                </ExpandableCardHeader>
                <div className="flex h-[calc(100dvh-482px)] flex-col p-4">
                  <ScrollArea
                    className="mb-2 w-full flex-grow"
                    ref={scrollAreaRef}
                  >
                    <MessageList
                      messages={messages}
                      isThinking={isThinking}
                      isRunning={isRunning}
                      isBuilding={isBuilding}
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
                        placeholder="Create, refine, or fix your function with Weldr..."
                        onChange={onChatChange}
                        onSubmit={async () => {
                          if (userMessageContent && !isGenerating) {
                            await handleOnSubmit();
                          }
                        }}
                      />
                      <Button
                        type="submit"
                        disabled={!userMessageContent || isGenerating}
                        size="sm"
                        className="absolute right-2 bottom-2 disabled:bg-muted-foreground"
                      >
                        Send
                        <span className="ml-1">
                          <span className="rounded-sm bg-white/20 px-1 py-0.5 disabled:text-muted-foreground">
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
                {data.canRun ? (
                  <ScrollArea className="size-full">
                    <div className="max-h-[500px] space-y-2">
                      {data.rawDescription && (
                        <div className="flex flex-col space-y-1">
                          <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
                            Description:
                          </span>
                          <RawContentViewer
                            rawContent={data.rawDescription ?? []}
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center justify-between pr-2">
                          <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
                            Input:
                          </span>
                          {data.inputSchema && (
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
                          )}
                        </div>
                        {data.inputSchema ? (
                          <TreeView
                            data={schemaToTreeData(data.inputSchema ?? {})}
                          />
                        ) : (
                          <div className="flex items-center justify-center">
                            <span className="text-muted-foreground text-xs">
                              Doesn't accept any input
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
                          Output:
                        </span>
                        {data.outputSchema ? (
                          <TreeView
                            data={schemaToTreeData(data.outputSchema ?? {})}
                          />
                        ) : (
                          <div className="flex items-center justify-center">
                            <span className="text-muted-foreground text-xs">
                              Doesn't return any output
                            </span>
                          </div>
                        )}
                      </div>

                      {data.behavior && (
                        <div className="space-y-1">
                          <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
                            Behavior:
                          </span>
                          <div className="prose prose-li:my-0 prose-ol:my-0 prose-ul:my-0 cursor-text select-text prose-code:text-primary text-foreground text-sm prose-ol:marker:text-foreground [&_ol]:text-foreground [&_ol]:marker:text-foreground">
                            <RawContentViewer
                              rawContent={data.behavior ?? []}
                            />
                          </div>
                        </div>
                      )}

                      {data.errors && (
                        <div className="space-y-1">
                          <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
                            Errors:
                          </span>
                          <div className="prose prose-li:my-0 prose-ol:my-0 prose-ul:my-0 cursor-text select-text prose-code:text-primary text-foreground text-sm">
                            <ReactMarkdown
                              components={{
                                code: ({ children }) => (
                                  <span className="inline-flex items-center rounded-md border bg-accent px-1.5 py-0.5 text-destructive text-xs">
                                    {children}
                                  </span>
                                ),
                              }}
                            >
                              {data.errors}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-center text-muted-foreground text-sm">
                      Chat with Weldr to build the function
                    </span>
                  </div>
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          </ExpandableCardContent>
        </ExpandableCard>
        <Handle
          className={cn(
            "rounded-full border bg-background p-1",
            showEdges ? "" : "opacity-0",
          )}
          type="target"
          position={Position.Left}
          isConnectable={false}
        />
        <Handle
          className={cn(
            "rounded-full border bg-background p-1",
            showEdges ? "" : "opacity-0",
          )}
          type="source"
          position={Position.Right}
          isConnectable={false}
        />
        <DeleteAlertDialog
          open={deleteAlertDialogOpen}
          setOpen={setDeleteAlertDialogOpen}
          onDelete={async () => {
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
