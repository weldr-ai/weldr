"use client";

import { Badge } from "@integramind/ui/badge";
import { Button } from "@integramind/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@integramind/ui/form";
import { Input } from "@integramind/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@integramind/ui/select";
import { Textarea } from "@integramind/ui/textarea";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  ClipboardIcon,
  Loader2Icon,
  PanelRightCloseIcon,
  PlayCircleIcon,
  RocketIcon,
} from "lucide-react";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  AssistantMessageRawContent,
  ConversationMessage,
  EndpointFlowMetadata,
  FlatInputSchema,
  Flow,
  FlowInputSchemaMessage,
  FlowOutputSchemaMessage,
  JsonSchema,
  UserMessageRawContent,
} from "@integramind/shared/types";
import { userMessageRawContentReferenceElementSchema } from "@integramind/shared/validators/conversations";
import {
  baseUpdateFlowSchema,
  updateEndpointFlowSchema,
  updateFlowSchema,
  type updateTaskFlowSchema,
} from "@integramind/shared/validators/flows";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@integramind/ui/popover";
import { ScrollArea } from "@integramind/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@integramind/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@integramind/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import { TreeView } from "@integramind/ui/tree-view";
import { toast } from "@integramind/ui/use-toast";
import { createId } from "@paralleldrive/cuid2";
import { useHandleConnections, useNodesData } from "@xyflow/react";
import { type StreamableValue, readStreamableValue } from "ai/rsc";
import type { EditorState, LexicalEditor, ParagraphNode } from "lexical";
import { $getRoot } from "lexical";
import { debounce } from "perfect-debounce";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { executeFlow } from "~/lib/actions/execute";
import {
  generateFlowInputsSchemas,
  generateFlowOutputsSchemas,
} from "~/lib/ai/generator";
import { api } from "~/lib/trpc/react";
import {
  flattenInputSchema,
  jsonSchemaToTreeData,
  rawMessageContentToText,
} from "~/lib/utils";
import type { FlowNode } from "~/types";
import Editor from "./editor";
import type { ReferenceNode } from "./editor/nodes/reference-node";
import { JsonViewer } from "./json-viewer";
import MessageList from "./message-list";
import { TestInputDialog } from "./test-input-dialog";

export function FlowSheet({ initialData }: { initialData: Flow }) {
  const [generationMode, setGenerationMode] = useState<
    "input" | "output" | null
  >(null);

  const [isOpen, setIsOpen] = useState(false);

  const { data, refetch } = api.flows.getById.useQuery(
    {
      id: initialData.id,
    },
    {
      initialData,
    },
  );

  const stopNodeConnections = useHandleConnections({
    type: "target",
    nodeId: data.stopNode.id,
  });

  const nodesData = useNodesData<FlowNode>(
    stopNodeConnections.map((connection) => connection.source),
  );

  const outputReferencesSchema = nodesData.reduce((acc, node) => {
    if (node.data.metadata?.outputSchema) {
      const schema = flattenInputSchema({
        schema: node.data.metadata.outputSchema,
        expandArrays: false,
      });
      return acc.concat(schema);
    }
    return acc;
  }, [] as FlatInputSchema[]);

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
  const outputTree = jsonSchemaToTreeData(data.outputSchema as JsonSchema);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSchemas, setIsGeneratingSchemas] = useState(false);

  const inputConversation = useMemo(() => {
    const messages: ConversationMessage[] = [
      {
        id: createId(),
        role: "assistant",
        content: `Hi there! I'm Specly, your AI assistant. What are your flow's input?`,
        rawContent: [
          {
            type: "text",
            value: `Hi there! I'm Specly, your AI assistant. What are your flow's input?`,
          },
        ],
      },
      ...data.inputConversation.messages.sort(
        (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
      ),
    ];

    return messages;
  }, [data.inputConversation.messages]);

  const outputConversation = useMemo(() => {
    const messages: ConversationMessage[] = [
      {
        id: createId(),
        role: "assistant",
        content: `Hi there! I'm Specly, your AI assistant. What are your flow's output?`,
        rawContent: [
          {
            type: "text",
            value: `Hi there! I'm Specly, your AI assistant. What are your flow's output?`,
          },
        ],
      },
      ...data.outputConversation.messages.sort(
        (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
      ),
    ];

    return messages;
  }, [data.outputConversation.messages]);

  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const [userMessageContent, setUserMessageContent] = useState<string | null>(
    null,
  );
  const [userMessageRawContent, setUserMessageRawContent] =
    useState<UserMessageRawContent>([]);

  const onSubmit = async (generationMode: "input" | "output") => {
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
      conversationId:
        generationMode === "input"
          ? data.inputConversation.id
          : data.outputConversation.id,
      createdAt: new Date(),
    };

    const newMessages: ConversationMessage[] = [...messages, newMessageUser];

    setMessages(newMessages);

    await addMessage.mutateAsync(newMessageUser);

    let result: StreamableValue<
      FlowInputSchemaMessage | FlowOutputSchemaMessage
    >;

    if (generationMode === "input") {
      result = await generateFlowInputsSchemas({
        flowId: data.id,
        conversationId: data.inputConversationId,
        messages: newMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });
    } else {
      result = await generateFlowOutputsSchemas({
        flowId: data.id,
        conversationId: data.outputConversationId,
        messages: newMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });
    }

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
        const rawContent: AssistantMessageRawContent = [
          {
            type: "text",
            value: `Generating the following ${
              generationMode === "input" ? "input" : "output"
            } schema: `,
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

    const schemaMessageObject = JSON.parse(newAssistantMessageStr) as
      | FlowInputSchemaMessage
      | FlowOutputSchemaMessage;

    if (schemaMessageObject.message.type === "end") {
      setIsGeneratingSchemas(true);

      const schemaBuiltSuccessfullyMessage: ConversationMessage = {
        role: "assistant",
        rawContent: [
          {
            type: "text",
            value: `Your ${
              generationMode === "input" ? "input" : "output"
            } schema has been built successfully!`,
          },
        ],
        content: `Your ${
          generationMode === "input" ? "input" : "output"
        } schema has been built successfully!`,
        createdAt: new Date(),
      };

      setIsGeneratingSchemas(false);
      setMessages([...newMessages, schemaBuiltSuccessfullyMessage]);

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

  const [isDeploying, setIsDeploying] = useState(false);

  const [flowTestData, setFlowTestData] = useState<Record<
    string,
    unknown
  > | null>(null);

  const [flowTestResponse, setFlowTestResponse] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const [openTab, setOpenTab] = useState<"general" | "run" | "build">(
    "general",
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <SheetTrigger asChild>
        <Button className="rounded-full gap-2 text-xs" variant="ghost">
          {!(
            data.inputSchema &&
            data.validationSchema &&
            data.outputSchema
          ) && <AlertCircleIcon className="size-4 text-destructive" />}
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
      <SheetContent className="p-0 bg-muted border rounded-lg top-2 right-2 h-[calc(100vh-16px)] min-w-[700px]">
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
                        onClick={async () => {
                          setOpenTab("run");
                          setIsRunning(true);
                          console.log(flowTestData);
                          const response = await executeFlow({
                            flowUrl: `https://${data.workspaceId}.fly.dev${(data.metadata as EndpointFlowMetadata).path}`,
                            testData: flowTestData ?? {},
                          });
                          setFlowTestResponse(response);
                          setIsRunning(false);
                        }}
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
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            className="size-7 text-primary hover:text-primary"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setIsDeploying(true);
                              setTimeout(() => {
                                setIsDeploying(false);
                              }, 30000);
                            }}
                          >
                            <RocketIcon className="size-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          side="bottom"
                          align="end"
                          className="h-40 w-96"
                        >
                          {isDeploying ? (
                            <div className="flex flex-col size-full items-center justify-center gap-2">
                              <Loader2Icon className="size-3.5 animate-spin" />
                              <p className="text-xs text-muted-foreground">
                                Deploying...
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-col size-full items-center justify-center gap-3 px-4">
                              <div className="flex items-center gap-2">
                                <CheckCircle2Icon className="size-4 text-success" />
                                <p className="text-sm font-medium">
                                  Deployment successful!
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2 text-xs"
                                onClick={() => {
                                  const url = `https://${data.workspaceId}.fly.dev${(data.metadata as EndpointFlowMetadata).path}`;
                                  navigator.clipboard.writeText(url);
                                  toast({
                                    title: "URL copied",
                                    description:
                                      "You can now share it with others",
                                  });
                                }}
                              >
                                <span>{`https://${data.workspaceId}.fly.dev`}</span>
                                <ClipboardIcon className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
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
          <Tabs
            defaultValue="general"
            className="size-full p-4"
            value={openTab}
          >
            <TabsList className="w-full justify-start bg-accent">
              <TabsTrigger
                className="w-full"
                value="general"
                onClick={() => setOpenTab("general")}
              >
                General
              </TabsTrigger>
              <TabsTrigger
                className="w-full"
                value="build"
                onClick={() => setOpenTab("build")}
              >
                Build
              </TabsTrigger>
              <TabsTrigger
                className="w-full"
                value="run"
                onClick={() => setOpenTab("run")}
              >
                Run
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
                <div className="flex justify-between items-center">
                  <span className="text-sm">Input</span>
                  <TestInputDialog
                    schema={data.inputSchema as JsonSchema}
                    formData={flowTestData}
                    setFormData={(data) => {
                      setFlowTestData(data as Record<string, unknown>);
                    }}
                    onSubmit={() => {
                      console.log(flowTestData);
                    }}
                  />
                </div>
                {inputTree.length === 0 ? (
                  <div className="flex w-full text-xs items-center justify-center text-muted-foreground">
                    Chat with Specly to define your {data.type} input
                  </div>
                ) : (
                  <TreeView data={inputTree} expandAll={true} />
                )}
                <span className="text-sm">Output</span>
                {outputTree.length === 0 ? (
                  <div className="flex w-full text-xs items-center justify-center text-muted-foreground">
                    Chat with Specly to define your {data.type} output
                  </div>
                ) : (
                  <TreeView data={outputTree} expandAll={true} />
                )}
              </div>
            </TabsContent>
            <TabsContent value="build" className="size-full">
              {generationMode === null && (
                <div className="flex flex-col w-full h-[calc(100vh-250px)] justify-center items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Choose Specly's mode
                  </p>
                  <Button
                    className="w-48"
                    variant="outline"
                    onClick={() => {
                      setGenerationMode("input");
                      setMessages(inputConversation);
                    }}
                  >
                    Define {data.type} input
                  </Button>
                  <Button
                    className="w-48"
                    variant="outline"
                    onClick={() => {
                      setGenerationMode("output");
                      setMessages(outputConversation);
                    }}
                  >
                    Define {data.type} output
                  </Button>
                </div>
              )}
              {generationMode !== null && (
                <div className="flex flex-col justify-between h-[calc(100vh-186px)]">
                  <div className="flex size-full flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        className="size-8"
                        variant="outline"
                        size="icon"
                        onClick={() => setGenerationMode(null)}
                      >
                        <ArrowLeftIcon className="size-4" />
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        Define your {generationMode} with Specly
                      </p>
                    </div>
                    <ScrollArea
                      className="h-[calc(100vh-344px)] mb-4"
                      ref={scrollAreaRef}
                    >
                      <MessageList
                        messages={messages}
                        isGenerating={isGeneratingSchemas}
                        chatHistoryEndRef={chatHistoryEndRef}
                      />
                    </ScrollArea>
                  </div>
                  <div className="mt-auto">
                    <form className="relative">
                      <Editor
                        editorRef={editorRef}
                        id={createId()}
                        onChange={onChatChange}
                        rawMessage={userMessageRawContent}
                        placeholder={`Define your ${data.type} ${generationMode} with Specly...`}
                        typeaheadPosition="bottom"
                        inputSchema={
                          generationMode === "output"
                            ? outputReferencesSchema
                            : undefined
                        }
                        includeReferences={generationMode === "input"}
                      />
                      <Button
                        type="button"
                        disabled={!userMessageContent || isGenerating}
                        size="sm"
                        className="absolute bottom-2 right-2 disabled:bg-muted-foreground"
                        onClick={async () => {
                          await onSubmit(generationMode);
                        }}
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
              )}
            </TabsContent>
            <TabsContent value="run" className="size-full">
              <div className="flex flex-col gap-2 bg-background p-4 rounded-lg h-[calc(100vh-186px)]">
                {isRunning ? (
                  <div className="flex flex-col size-full items-center justify-center gap-2">
                    <Loader2Icon className="size-3.5 animate-spin" />
                    <p className="text-xs text-muted-foreground">Running...</p>
                  </div>
                ) : (
                  <JsonViewer data={flowTestResponse} />
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
