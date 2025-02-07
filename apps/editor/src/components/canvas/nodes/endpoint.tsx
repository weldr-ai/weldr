import { DeleteAlertDialog } from "@/components/delete-alert-dialog";
import { Editor } from "@/components/editor";
import type { ReferenceNode } from "@/components/editor/plugins/reference/node";
import MessageList from "@/components/message-list";
import OpenApiEndpointDocs from "@/components/openapi-endpoint-docs";
import { generateEndpoint } from "@/lib/ai/generator";
import { useResources } from "@/lib/context/resources";
import { useFlowBuilder } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import { getResourceReferences } from "@/lib/utils";
import type { CanvasNode, CanvasNodeProps } from "@/types";
import { createId } from "@paralleldrive/cuid2";
import type { RouterOutputs } from "@weldr/api";
import type {
  ConversationMessage,
  EndpointRequirementsMessage,
  UserMessageRawContent,
} from "@weldr/shared/types";
import { userMessageRawContentReferenceElementSchema } from "@weldr/shared/validators/conversations";
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
import { type StreamableValue, readStreamableValue } from "ai/rsc";
import type { EditorState, LexicalEditor, ParagraphNode } from "lexical";
import { $getRoot } from "lexical";
import {
  CircleAlertIcon,
  ExternalLinkIcon,
  FileTextIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import type { OpenAPIV3 } from "openapi-types";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";

export const EndpointNode = memo(
  ({
    data: _data,
    selected,
    positionAbsoluteX,
    positionAbsoluteY,
  }: CanvasNodeProps) => {
    const { data: fetchedData } = api.endpoints.byId.useQuery(
      {
        id: _data.id,
      },
      {
        initialData: _data as RouterOutputs["endpoints"]["byId"],
      },
    );

    const data = fetchedData;

    const { deleteElements, fitBounds } = useReactFlow<CanvasNode>();

    const apiUtils = api.useUtils();

    const deleteEndpoint = api.endpoints.delete.useMutation();

    const addMessage = api.conversations.addMessage.useMutation();

    const editorRef = useRef<LexicalEditor>(null);

    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);
    const [isThinking, setIsThinking] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isBuilding, setIsBuilding] = useState<boolean>(false);

    const [messages, setMessages] = useState<ConversationMessage[]>([
      {
        id: createId(),
        role: "assistant",
        rawContent: [
          {
            type: "text",
            value:
              "Hi there! I'm Weldr, your AI assistant. What does your endpoint do?",
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
                "Hi there! I'm Weldr, your AI assistant. What does your endpoint do?",
            },
          ],
        },
        ...(data.conversation?.messages ?? []),
      ]);
    }, [data.conversation]);

    function onChatChange(editorState: EditorState) {
      editorState.read(async () => {
        const root = $getRoot();
        const text = root.getTextContent();
        const children = (
          root.getChildren()[0] as ParagraphNode
        )?.getChildren();

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

        setUserMessageContent(text);
        setUserMessageRawContent(userMessageRawContent);
      });
    }

    const handleOnSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
      if (e) {
        e.preventDefault();
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
        conversationId: data.conversationId,
        rawContent: userMessageRawContent,
      });

      const result = await generateEndpoint(data.id);

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
        result as StreamableValue<EndpointRequirementsMessage>,
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
          content?.message?.content?.openApiSpec
        ) {
          setIsThinking(false);
          setIsBuilding(true);
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

      const endpointRequirementsMessageObject = JSON.parse(
        newAssistantMessageStr,
      ) as EndpointRequirementsMessage;

      // if code generation is set, disable it and refetch the updated endpoint metadata
      if (endpointRequirementsMessageObject.message.type === "end") {
        await apiUtils.endpoints.byId.invalidate({ id: data.id });
        await apiUtils.versions.dependencies.invalidate({
          projectId: data.projectId,
        });
        setIsBuilding(false);
      }

      setUserMessageContent(null);
      setUserMessageRawContent([]);
      setIsGenerating(false);
    };

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

    const { showEdges } = useFlowBuilder();

    const resources = useResources();
    const availableHelperFunctions = api.dependencies.available.useQuery({
      dependentType: "endpoint",
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
                      <span
                        className={cn(
                          "rounded-sm px-1.5 py-0.5 font-bold text-xs uppercase",
                          {
                            "bg-primary/30 text-primary": data.method === "get",
                            "bg-success/30 text-success":
                              data.method === "post",
                            "bg-warning/30 text-warning": data.method === "put",
                            "bg-destructive/30 text-destructive":
                              data.method === "delete",
                            "p-0 font-semibold text-primary text-xs":
                              !data.method,
                          },
                        )}
                      >
                        {data.method?.toUpperCase() ?? "API"}
                      </span>
                      <span className="text-muted-foreground">Endpoint</span>
                    </div>
                    {!data.canRun && (
                      <CircleAlertIcon className="size-4 text-destructive" />
                    )}
                  </div>
                  <span className="w-full truncate text-start text-sm">
                    {data.openApiSpec?.summary ?? "Unimplemented Endpoint"}
                  </span>
                </Card>
              </ExpandableCardTrigger>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuLabel className="text-xs">Endpoint</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem className="flex items-center justify-between text-xs">
                <Link
                  className="flex items-center"
                  href="https://docs.weldr.ai/endpoints"
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
                <div className="flex flex-col items-start justify-start gap-2 border-b p-4">
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-primary text-xs">
                        API
                      </span>
                      <span className="text-muted-foreground">Endpoint</span>
                    </div>
                  </div>
                  <h3
                    className={cn("text-sm", {
                      "text-destructive": !data.openApiSpec,
                    })}
                  >
                    {data.openApiSpec?.summary ?? "Unimplemented Endpoint"}
                  </h3>
                </div>
                <div className="flex h-[calc(100dvh-474px)] flex-col p-4">
                  <ScrollArea className="mb-4 flex-grow" ref={scrollAreaRef}>
                    <MessageList
                      messages={messages}
                      isThinking={isThinking}
                      isBuilding={isBuilding}
                    />
                    <div ref={chatHistoryEndRef} />
                  </ScrollArea>

                  <div className="relative">
                    <Editor
                      className="h-full"
                      id={data.id}
                      references={references}
                      editorRef={editorRef}
                      placeholder="Chat about your endpoint..."
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
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={35} minSize={20}>
                <ScrollArea className="h-[calc(100dvh-398px)] p-4">
                  {!data.openApiSpec ? (
                    <div className="flex h-[calc(100dvh-432px)] items-center justify-center">
                      <span className="text-muted-foreground text-sm">
                        Develop your endpoint to see summary
                      </span>
                    </div>
                  ) : (
                    <OpenApiEndpointDocs
                      spec={
                        {
                          openapi: "3.0.0",
                          info: {
                            title: "Sample API",
                            version: "1.0.0",
                          },
                          paths: {
                            [data.openApiSpec.path]: {
                              [data.openApiSpec.method]: data.openApiSpec,
                            },
                          },
                        } as OpenAPIV3.Document
                      }
                    />
                  )}
                </ScrollArea>
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

            deleteEndpoint.mutate({
              id: data.id,
            });
          }}
        />
      </>
    );
  },
);
