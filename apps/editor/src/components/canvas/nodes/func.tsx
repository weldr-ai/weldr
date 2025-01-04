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
import type { z } from "zod";

import { DeleteAlertDialog } from "@/components/delete-alert-dialog";
import { Editor } from "@/components/editor";
import { TestInputDialog } from "@/components/test-input-dialog";
import { generateFunc } from "@/lib/ai/generator";
import { useResources } from "@/lib/context/resources";
import { useFlowBuilderStore } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import { getResourceReferences } from "@/lib/utils";
import type { CanvasNode, CanvasNodeProps } from "@/types";
import type { RouterOutputs } from "@integramind/api";
import type {
  AssistantMessageRawContent,
  ConversationMessage,
  FuncRequirementsMessage,
  JsonSchema,
  UserMessageRawContent,
} from "@integramind/shared/types";
import { toTitle } from "@integramind/shared/utils";
import { userMessageRawContentReferenceElementSchema } from "@integramind/shared/validators/conversations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
import { toast } from "@integramind/ui/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import { TreeView, schemaToTreeData } from "@integramind/ui/tree-view";
import { createId } from "@paralleldrive/cuid2";
import { type StreamableValue, readStreamableValue } from "ai/rsc";
import ReactMarkdown from "react-markdown";
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

    const addMessage = api.conversations.addMessage.useMutation();

    const editorRef = useRef<LexicalEditor>(null);

    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);

    const showEdges = useFlowBuilderStore((state) => state.showEdges);
    const [isThinking, setIsThinking] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isBuilding, setIsBuilding] = useState<boolean>(false);
    const [isRunning, setIsRunning] = useState<boolean>(false);
    const [testInput, setTestInput] = useState<unknown>(data.testInput ?? {});

    const [messages, setMessages] = useState<ConversationMessage[]>([
      {
        id: createId(),
        role: "assistant",
        content:
          "Hi there! I'm IntegraMind, your AI assistant. What does your function do?",
        rawContent: [
          {
            type: "text",
            value:
              "Hi there! I'm IntegraMind, your AI assistant. What does your function do?",
          },
        ],
      },
      ...(data.conversation?.messages ?? []),
    ]);
    const [userMessageContent, setUserMessageContent] = useState<string | null>(
      null,
    );
    const [userMessageRawContent, setUserMessageRawContent] =
      useState<UserMessageRawContent>([]);

    useEffect(() => {
      setMessages([
        {
          id: createId(),
          role: "assistant",
          rawContent: [
            {
              type: "text",
              value:
                "Hi there! I'm IntegraMind, your AI assistant. What does your function do?",
            },
          ],
        },
        ...(data.conversation?.messages ?? []),
      ]);
    }, [data.conversation]);

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
          setIsBuilding(true);
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
        await apiUtils.funcs.byId.invalidate({ id: data.id });
        await apiUtils.dependencies.available.invalidate();
        await apiUtils.projects.dependencies.invalidate({
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          id: data.projectId!,
        });
        setIsBuilding(false);
      }

      setUserMessageContent(null);
      setUserMessageRawContent([]);
      setIsGenerating(false);
    };

    const resources = useResources();
    const availableHelperFunctions = api.dependencies.available.useQuery({
      dependentType: "function",
      dependentVersionId: data.currentVersionId,
    });

    const helperFunctionReferences = availableHelperFunctions.data?.reduce(
      (acc, func) => {
        if (!func.name) {
          return acc;
        }

        acc.push({
          type: "reference",
          referenceType: "function",
          id: func.id,
          name: func.name,
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
                      currentVersionId={data.currentVersionId}
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
                        placeholder="Create, refine, or fix your function with IntegraMind..."
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

                      {data.inputSchema && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between pr-2">
                            <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
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
                            data={schemaToTreeData(data.inputSchema ?? {})}
                          />
                        </div>
                      )}

                      {data.outputSchema && (
                        <div className="space-y-1">
                          <span className="cursor-text select-text font-semibold text-muted-foreground text-sm">
                            Output:
                          </span>
                          <TreeView
                            data={schemaToTreeData(data.outputSchema ?? {})}
                          />
                        </div>
                      )}

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
                      Chat with IntegraMind to build the function
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
