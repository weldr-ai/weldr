"use client";

import type { RouterOutputs } from "@integramind/api";
import type {
  AssistantMessageRawContent,
  ConversationMessage,
  FuncRequirementsMessage,
  UserMessageRawContent,
} from "@integramind/shared/types";
import { userMessageRawContentReferenceElementSchema } from "@integramind/shared/validators/conversations";
import { Button } from "@integramind/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@integramind/ui/resizable";
import { ScrollArea } from "@integramind/ui/scroll-area";
import { type StreamableValue, readStreamableValue } from "ai/rsc";
import {
  $getRoot,
  type EditorState,
  type LexicalEditor,
  type ParagraphNode,
} from "lexical";
import type { OpenAPIV3 } from "openapi-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { Editor } from "~/components/editor";
import MessageList from "~/components/message-list";
import { generateFunc } from "~/lib/ai/generator";
import { api } from "~/lib/trpc/client";
import type { ReferenceNode } from "./editor/plugins/reference/node";
import OpenApiEndpointDocs from "./openapi-endpoint-docs";

export function EndpointView({
  initialData,
}: {
  initialData: RouterOutputs["endpoints"]["byId"];
}) {
  const { data: endpoint } = api.endpoints.byId.useQuery(
    {
      id: initialData.id,
    },
    {
      initialData,
    },
  );

  const addMessage = api.conversations.addMessage.useMutation();

  const apiUtils = api.useUtils();

  const editorRef = useRef<LexicalEditor>(null);

  const [isThinking, setIsThinking] = useState(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);

  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      role: "assistant",
      rawContent: [
        {
          type: "text",
          value: "Hey, I'm your endpoint builder. How can I help you?",
        },
      ],
      createdAt: new Date(),
    },
    ...(endpoint.conversation?.messages ?? []),
  ]);

  const [userMessageContent, setUserMessageContent] = useState<string | null>(
    null,
  );

  const [userMessageRawContent, setUserMessageRawContent] =
    useState<UserMessageRawContent>([]);

  function onChatChange(editorState: EditorState) {
    editorState.read(async () => {
      const root = $getRoot();
      const text = root.getTextContent();
      const children = (root.getChildren()[0] as ParagraphNode)?.getChildren();

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
      conversationId: endpoint.conversationId,
      createdAt: new Date(),
    };

    const newMessages = [...messages, newMessageUser];

    setMessages(newMessages);

    await addMessage.mutateAsync({
      role: "user",
      conversationId: endpoint.conversationId,
      rawContent: userMessageRawContent,
    });

    const result = await generateFunc({
      funcId: endpoint.id,
      conversationId: endpoint.conversationId,
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
            value: "Generating the following endpoint: ",
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

    // if code generation is set, disable it and refetch the updated endpoint metadata
    if (funcRequirementsMessageObject.message.type === "end") {
      setIsGeneratingCode(false);
      const funcBuiltSuccessfullyMessage: ConversationMessage = {
        role: "assistant",
        rawContent: [
          {
            type: "text",
            value: "Your endpoint has been built successfully!",
          },
        ],
        createdAt: new Date(),
      };

      await apiUtils.endpoints.byId.invalidate({ id: endpoint.id });
      setMessages([...newMessages, funcBuiltSuccessfullyMessage]);
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
        const offset = lastMessageRect.bottom - scrollContainerRect.bottom + 16;

        if (offset > 0) {
          scrollContainer.scrollTop += offset;
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const { data: funcs } = api.funcs.byProjectId.useQuery({
    projectId: endpoint.projectId,
  });

  const helperFunctionReferences = funcs?.reduce(
    (acc, func) => {
      if (!func.name || !func.inputSchema || !func.outputSchema) {
        return acc;
      }

      acc.push({
        type: "reference",
        referenceType: "function",
        id: func.id,
        name: `${func.module.name}.${func.name}`,
        moduleName: func.module.name,
      });

      return acc;
    },
    [] as z.infer<typeof userMessageRawContentReferenceElementSchema>[],
  );

  const references = useMemo(() => {
    return [...(helperFunctionReferences ?? [])];
  }, [helperFunctionReferences]);

  return (
    <ResizablePanelGroup direction="horizontal" className="flex size-full">
      <ResizablePanel defaultSize={50} minSize={30}>
        <div className="flex h-full flex-col p-4">
          <ScrollArea className="flex-grow mb-4" ref={scrollAreaRef}>
            <MessageList
              messages={messages}
              isThinking={isThinking}
              isGenerating={isGeneratingCode}
            />
            <div ref={chatHistoryEndRef} />
          </ScrollArea>

          <div className="relative">
            <Editor
              className="h-full"
              id={endpoint.id}
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
              className="absolute bottom-2 right-2 disabled:bg-muted-foreground"
            >
              Send
              <span className="ml-1">
                <span className="px-1 py-0.5 bg-white/20 rounded-sm disabled:text-muted-foreground">
                  {typeof window !== "undefined" &&
                  window.navigator?.userAgent.toLowerCase().includes("mac")
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

      <ResizablePanel defaultSize={50} minSize={30}>
        <ScrollArea className="h-full p-4">
          <OpenApiEndpointDocs
            spec={
              endpoint.openApiSpec &&
              Object.keys(endpoint.openApiSpec).length > 0
                ? (endpoint.openApiSpec as OpenAPIV3.Document)
                : ({
                    openapi: "3.0.0",
                    info: {
                      title: "Sample API",
                      version: "1.0.0",
                    },
                    paths: {
                      [endpoint.path]: {
                        [endpoint.httpMethod.toLowerCase()]: {
                          summary: endpoint.name,
                          description: endpoint.description,
                          requestBody: {
                            required: true,
                            content: {
                              "application/json": {
                                schema: {
                                  type: "object",
                                  required: ["username", "ticker"],
                                  properties: {
                                    username: {
                                      type: "string",
                                      description: "Username of the account",
                                    },
                                    ticker: {
                                      type: "string",
                                      description: "Stock ticker symbol",
                                    },
                                  },
                                },
                              },
                            },
                          },
                          responses: {
                            "200": {
                              description: "Successful response",
                              content: {
                                "application/json": {
                                  schema: {
                                    type: "object",
                                    properties: {
                                      count: {
                                        type: "integer",
                                        description: "Number of stocks",
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            "400": {
                              description: "Bad request",
                            },
                          },
                        },
                      },
                    },
                  } as OpenAPIV3.Document)
            }
          />
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
