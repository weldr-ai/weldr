"use client";

import { Badge } from "@specly/ui/badge";
import { Button } from "@specly/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@specly/ui/select";
import { Textarea } from "@specly/ui/textarea";
import {
  AlertCircleIcon,
  PanelRightCloseIcon,
  PlayCircleIcon,
  RocketIcon,
} from "lucide-react";

import { zodResolver } from "@hookform/resolvers/zod";
import { createId } from "@paralleldrive/cuid2";
import type {
  AssistantMessageRawContent,
  ConversationMessage,
  Flow,
  FlowInputsSchemaMessage,
  JsonSchema,
  UserMessageRawContent,
} from "@specly/shared/types";
import { userMessageRawContentReferenceElementSchema } from "@specly/shared/validators/conversations";
import {
  baseUpdateFlowSchema,
  updateEndpointFlowSchema,
  updateFlowSchema,
  type updateTaskFlowSchema,
} from "@specly/shared/validators/flows";
import { ScrollArea } from "@specly/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@specly/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@specly/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@specly/ui/tooltip";
import { TreeView } from "@specly/ui/tree-view";
import { readStreamableValue } from "ai/rsc";
import type { EditorState, LexicalEditor, ParagraphNode } from "lexical";
import { $getRoot } from "lexical";
import { debounce } from "perfect-debounce";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { generateFlowInputsSchemas } from "~/lib/ai/generator";
import { api } from "~/lib/trpc/react";
import { jsonSchemaToTreeData, rawMessageContentToText } from "~/lib/utils";
import Editor from "./editor";
import type { ReferenceNode } from "./editor/nodes/reference-node";
import MessageList from "./message-list";

export function FlowSheet({ initialData }: { initialData: Flow }) {
  const [isOpen, setIsOpen] = useState(false);

  const { data, refetch } = api.flows.getById.useQuery(
    {
      id: initialData.id,
    },
    {
      initialData,
    },
  );

  const updateFlow = api.flows.update.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

  const addMessage = api.conversations.addMessage.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

  const getDefaultValues = () => {
    const defaultValues = {
      type: data.type,
      name: data.name ?? undefined,
      description: data.description ?? undefined,
      inputSchema: data.inputSchema ?? undefined,
      metadata: {},
    };

    switch (data.type) {
      case "endpoint":
        return {
          ...defaultValues,
          metadata: {
            method: data.metadata.method,
            path: data.metadata.path,
          },
        } as z.infer<typeof updateEndpointFlowSchema>;
      case "task":
        return {
          ...defaultValues,
          metadata: {
            triggerType: data.metadata.triggerType,
          },
        } as z.infer<typeof updateTaskFlowSchema>;
    }
  };

  const editorRef = useRef<LexicalEditor>(null);

  const form = useForm<z.infer<typeof updateFlowSchema>>({
    resolver: zodResolver(updateFlowSchema),
    defaultValues: {
      where: {
        id: data.id,
      },
      payload: {
        ...getDefaultValues(),
      },
    },
  });

  const inputTree = jsonSchemaToTreeData(data.inputSchema as JsonSchema);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSchemas, setIsGeneratingSchemas] = useState(false);

  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: createId(),
      role: "assistant",
      content:
        "Hi there! I'm Specly, your AI assistant. What are your flow's inputs?",
      rawContent: [
        {
          type: "text",
          value:
            "Hi there! I'm Specly, your AI assistant. What are your flow's inputs?",
        },
      ],
      conversationId: data.conversation.id,
    },
    ...(data.conversation.messages.sort(
      (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
    ) as ConversationMessage[]),
    ...((data.inputSchema && data.validationSchema
      ? [
          {
            id: createId(),
            role: "assistant",
            content: "Your inputs schema has been built successfully!",
            rawContent: [
              {
                type: "text",
                value: "Your inputs schema has been built successfully!",
              },
            ],
            conversationId: data.conversation.id,
          },
        ]
      : []) as ConversationMessage[]),
  ]);

  const [userMessageContent, setUserMessageContent] = useState<string | null>(
    null,
  );
  const [userMessageRawContent, setUserMessageRawContent] =
    useState<UserMessageRawContent>([]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

    const newMessageUser: ConversationMessage = {
      role: "user",
      content: userMessageContent,
      rawContent: userMessageRawContent,
      conversationId: data.conversation.id,
    };

    const newMessages: ConversationMessage[] = [...messages, newMessageUser];

    setMessages(newMessages);

    await addMessage.mutateAsync(newMessageUser);

    const result = await generateFlowInputsSchemas({
      flowId: data.id,
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
        conversationId: data.conversation.id,
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
        const rawContent: AssistantMessageRawContent = [
          {
            type: "text",
            value: "Generating the following inputs schema: ",
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

    const inputsSchemaMessageObject = JSON.parse(
      newAssistantMessageStr,
    ) as FlowInputsSchemaMessage;

    if (inputsSchemaMessageObject.message.type === "end") {
      setIsGeneratingSchemas(true);

      const inputsSchemaBuiltSuccessfullyMessage: ConversationMessage = {
        role: "assistant",
        rawContent: [
          {
            type: "text",
            value: "Your inputs schema has been built successfully!",
          },
        ],
        content: "Your inputs schema has been built successfully!",
        conversationId: data.conversation.id,
      };

      setIsGeneratingSchemas(false);
      setMessages([...newMessages, inputsSchemaBuiltSuccessfullyMessage]);

      await refetch();
    }

    setUserMessageContent(null);
    setUserMessageRawContent([]);
    setIsGenerating(false);
  };

  function onChatChange(editorState: EditorState) {
    editorState.read(async () => {
      const root = $getRoot();
      const children = (root.getChildren()[0] as ParagraphNode)?.getChildren();
      const chat = root.getTextContent();
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

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <SheetTrigger asChild>
        <Button className="rounded-full gap-2 text-xs" variant="ghost">
          {!(data.inputSchema && data.validationSchema) && (
            <AlertCircleIcon className="size-4 text-destructive" />
          )}
          {data.type === "endpoint" ? (
            <span className="p-0.5 px-3 rounded-full border border-primary bg-primary/20 text-primary">
              {data.metadata.method.toUpperCase()}
            </span>
          ) : data.type === "task" ? (
            <span className="p-0.5 px-3 rounded-full border border-primary bg-primary/20 text-primary">
              {data.metadata.triggerType.toUpperCase()}
            </span>
          ) : (
            <></>
          )}
          <span>{data.name}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="p-0 bg-muted border rounded-lg top-2 right-2 h-[calc(100vh-16px)] min-w-[500px]">
        <Form {...form}>
          <SheetHeader>
            <SheetTitle className="flex flex-col items-start justify-start border-b p-4">
              <div className="flex w-full items-center justify-between">
                <div className="flex w-full items-center gap-2">
                  <Badge variant="default" className="text-xs">
                    {data.type === "endpoint"
                      ? data.metadata.method.toUpperCase()
                      : data.type === "task"
                        ? data.metadata.triggerType.toUpperCase()
                        : "COMPONENT"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
                  </span>
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
                    <TooltipContent
                      side="bottom"
                      className="bg-muted border text-success"
                    >
                      <p>Run</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="size-7 text-primary hover:text-primary"
                        variant="ghost"
                        size="icon"
                      >
                        <RocketIcon className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="bg-muted border text-primary"
                    >
                      <p>Deploy</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="size-7 text-muted-foreground hover:text-muted-foreground"
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsOpen(false)}
                      >
                        <PanelRightCloseIcon className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-muted border">
                      <p>Close</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <FormField
                control={form.control}
                name="payload.name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="off"
                        className="h-8 border-none shadow-none p-0 text-base focus-visible:ring-0 bg-muted"
                        placeholder={`${data.type.charAt(0).toUpperCase() + data.type.slice(1)} name`}
                        onChange={(e) => {
                          field.onChange(e);
                          debounce(
                            async () => {
                              const isValid =
                                baseUpdateFlowSchema.shape.name.safeParse(
                                  e.target.value,
                                ).success;
                              if (isValid) {
                                await updateFlow.mutateAsync({
                                  where: {
                                    id: data.id,
                                  },
                                  payload: {
                                    type: data.type,
                                    name: e.target.value,
                                  } as z.infer<
                                    typeof updateFlowSchema
                                  >["payload"],
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
            </SheetTitle>
          </SheetHeader>
          <Tabs defaultValue="general" className="size-full p-4">
            <TabsList className="w-full justify-start bg-accent">
              <TabsTrigger className="w-full" value="general">
                General
              </TabsTrigger>
              <TabsTrigger className="w-full" value="inputs">
                Inputs
              </TabsTrigger>
              <TabsTrigger className="w-full" value="summary">
                Summary
              </TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="size-full">
              <div className="flex flex-col gap-2">
                {data.type === "endpoint" && (
                  <>
                    <FormField
                      control={form.control}
                      name="payload.metadata.path"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">URL Path</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              autoComplete="off"
                              placeholder="Enter endpoint URL path"
                              value={field.value}
                              onChange={(e) => {
                                field.onChange(e);
                                debounce(
                                  async () => {
                                    const isValid =
                                      updateEndpointFlowSchema.shape.metadata.safeParse(
                                        {
                                          path: e.target.value,
                                        },
                                      ).success;
                                    if (isValid) {
                                      await updateFlow.mutateAsync({
                                        where: {
                                          id: data.id,
                                        },
                                        payload: {
                                          type: "endpoint",
                                          metadata: {
                                            path: e.target.value,
                                          },
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
                    <FormField
                      control={form.control}
                      name="payload.metadata.method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Method</FormLabel>
                          <FormControl>
                            <Select
                              {...field}
                              autoComplete="off"
                              name={field.name}
                              onValueChange={async (value) => {
                                field.onChange(value);
                                const isValid =
                                  updateEndpointFlowSchema.shape.metadata.safeParse(
                                    value,
                                  ).success;
                                if (isValid) {
                                  await updateFlow.mutateAsync({
                                    where: {
                                      id: data.id,
                                    },
                                    payload: {
                                      type: "endpoint",
                                      metadata: {
                                        method: value as
                                          | "get"
                                          | "post"
                                          | "patch"
                                          | "delete",
                                      },
                                    },
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="bg-background">
                                <SelectValue
                                  placeholder="Select method"
                                  className="placeholder-muted-foreground"
                                />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="get">GET</SelectItem>
                                <SelectItem value="post">POST</SelectItem>
                                <SelectItem value="patch">PATCH</SelectItem>
                                <SelectItem value="delete">DELETE</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                <FormField
                  control={form.control}
                  name="payload.description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          className="resize-none h-[244px]"
                          autoComplete="off"
                          placeholder={`Enter ${data.type} description`}
                          value={field.value}
                          onChange={(e) => {
                            field.onChange(e);
                            debounce(
                              async () => {
                                const isValid =
                                  baseUpdateFlowSchema.shape.description.safeParse(
                                    e.target.value,
                                  ).success;
                                if (isValid) {
                                  await updateFlow.mutateAsync({
                                    where: {
                                      id: data.id,
                                    },
                                    payload: {
                                      type: data.type,
                                      description: e.target.value,
                                    } as z.infer<
                                      typeof updateFlowSchema
                                    >["payload"],
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
              </div>
            </TabsContent>
            <TabsContent value="inputs" className="size-full">
              <div className="flex flex-col justify-between h-[calc(100vh-186px)]">
                <ScrollArea className="grow mb-4" ref={scrollAreaRef}>
                  <MessageList
                    messages={messages}
                    isGenerating={isGeneratingSchemas}
                    chatHistoryEndRef={chatHistoryEndRef}
                  />
                </ScrollArea>
                <div className="mt-auto">
                  <form className="relative" onSubmit={onSubmit}>
                    <Editor
                      editorRef={editorRef}
                      id={createId()}
                      onChange={onChatChange}
                      rawMessage={userMessageRawContent}
                      placeholder={`Define your ${data.type} inputs with AI...`}
                      typeaheadPosition="bottom"
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
            </TabsContent>
            <TabsContent value="summary" className="size-full">
              <div className="flex flex-col size-full gap-2">
                <span className="text-sm">Input</span>
                {inputTree.length === 0 ? (
                  <div className="flex size-full text-xs items-center justify-center text-muted-foreground">
                    Chat with Specly to define your {data.type} inputs
                  </div>
                ) : (
                  <TreeView data={inputTree} expandAll={true} />
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
