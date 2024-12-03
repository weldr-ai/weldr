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
  CheckCircle2Icon,
  ClipboardIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  MoreVerticalIcon,
  PanelRightCloseIcon,
  PlayCircleIcon,
  RocketIcon,
  TrashIcon,
} from "lucide-react";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  ConversationMessage,
  EndpointFlowMetadata,
  Flow,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
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
import type { EditorState, LexicalEditor, ParagraphNode } from "lexical";
import { $getRoot } from "lexical";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { debounce } from "perfect-debounce";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { api } from "~/lib/trpc/client";
import { jsonSchemaToTreeData, userMessageRawContentToText } from "~/lib/utils";
import { DeleteAlertDialog } from "./delete-alert-dialog";
import { Editor } from "./editor";
import type { ReferenceNode } from "./editor/plugins/reference/node";
import { JsonViewer } from "./json-viewer";
import MessageList from "./message-list";
import { TestInputDialog } from "./test-input-dialog";

export function FlowSheet({
  initialData,
}: {
  initialData: Flow;
}) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);

  const { data } = api.flows.byId.useQuery(
    {
      id: initialData.id,
    },
    {
      initialData,
    },
  );

  const apiUtils = api.useUtils();

  const updateFlow = api.flows.update.useMutation({
    onSuccess: async () => {
      await apiUtils.flows.byId.invalidate();
    },
  });

  const deleteFlow = api.flows.delete.useMutation({
    onSuccess: async () => {
      await apiUtils.flows.list.invalidate();
      router.push(`/workspaces/${data.workspaceId}`);
    },
  });

  const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] = useState(false);

  const addMessage = api.conversations.addMessage.useMutation();

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

  const [isThinking, setIsThinking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSchemas, _setIsGeneratingSchemas] = useState(false);

  const conversation = useMemo(() => {
    const messages: ConversationMessage[] = [
      {
        id: createId(),
        role: "assistant",
        content: `Hi there! I'm Specly, your AI assistant. What does this flow do?`,
        rawContent: [
          {
            type: "text",
            value: `Hi there! I'm Specly, your AI assistant. What does this flow do?`,
          },
        ],
      },
      ...data.conversation.messages.sort(
        (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
      ),
    ];

    return messages;
  }, [data.conversation.messages]);

  const [messages, setMessages] = useState<ConversationMessage[]>([
    ...conversation,
  ]);

  const [userMessageContent, setUserMessageContent] = useState<string | null>(
    null,
  );
  const [userMessageRawContent, setUserMessageRawContent] =
    useState<UserMessageRawContent>([]);

  const onSubmit = async () => {
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
      content: userMessageContent,
      rawContent: userMessageRawContent,
      conversationId: data.conversation.id,
      createdAt: new Date(),
    };

    const newMessages: ConversationMessage[] = [...messages, newMessageUser];

    setMessages(newMessages);

    await addMessage.mutateAsync(newMessageUser);

    // const result = await generateFlowCode({
    //   flowId: data.id,
    //   messages: newMessages,
    // });

    // let newAssistantMessageStr = "";
    // let newAssistantMessage: ConversationMessage | null = null;

    // for await (const content of readStreamableValue(result)) {
    //   newAssistantMessage = {
    //     role: "assistant",
    //     content: "",
    //     rawContent: [],
    //     createdAt: new Date(),
    //   };

    //   if (content?.message?.content && content.message.type === "message") {
    //     newAssistantMessage.content = assistantMessageRawContentToText(
    //       content.message.content,
    //     );
    //     newAssistantMessage.rawContent = content.message.content;
    //     setIsThinking(false);
    //   }

    //   // if end message, start generating code
    //   if (
    //     content?.message?.type === "end" &&
    //     content?.message?.content?.description
    //   ) {
    //     setIsThinking(false);
    //     const rawContent: AssistantMessageRawContent = [
    //       {
    //         type: "text",
    //         value: "Generating your flow...",
    //       },
    //       ...content.message.content.description,
    //     ];

    //     newAssistantMessage.content =
    //       assistantMessageRawContentToText(rawContent);
    //     newAssistantMessage.rawContent = rawContent;
    //   }

    //   if (newAssistantMessage) {
    //     setMessages([...newMessages, newAssistantMessage]);
    //   }
    //   newAssistantMessageStr = JSON.stringify(content);
    // }

    // // add the last message to the new messages temporary list
    // if (newAssistantMessage) {
    //   newMessages.push(newAssistantMessage);
    // }

    // const schemaMessageObject = JSON.parse(newAssistantMessageStr);

    // if (schemaMessageObject.message.type === "end") {
    //   setIsGeneratingSchemas(true);

    //   const schemaBuiltSuccessfullyMessage: ConversationMessage = {
    //     role: "assistant",
    //     rawContent: [
    //       {
    //         type: "text",
    //         value: "Your flow has been built successfully!",
    //       },
    //     ],
    //     content: "Your flow has been built successfully!",
    //     createdAt: new Date(),
    //   };

    //   await apiUtils.flows.byId.invalidate({
    //     id: data.id,
    //   });
    //   setIsGeneratingSchemas(false);
    //   setMessages([...newMessages, schemaBuiltSuccessfullyMessage]);
    // }

    setUserMessageContent(null);
    setUserMessageRawContent([]);
    setIsGenerating(false);
  };

  function onChatChange(editorState: EditorState) {
    editorState.read(async () => {
      const root = $getRoot();
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

      const chat = userMessageRawContentToText(userMessageRawContent);
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

  const [flowTestResponse, _setFlowTestResponse] = useState<string | null>(
    null,
  );
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
                          // const response = await executeFlow({
                          //   flowUrl: `https://${data.workspaceId}.fly.dev${(data.metadata as EndpointFlowMetadata).path}`,
                          //   testData: flowTestData ?? {},
                          // });
                          // setFlowTestResponse(response);
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

                  <Popover>
                    <PopoverTrigger asChild>
                      <Tooltip>
                        <TooltipTrigger asChild>
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
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="bg-muted border text-primary"
                        >
                          <p>Deploy</p>
                        </TooltipContent>
                      </Tooltip>
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
                                description: "You can now share it with others",
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

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="size-7 text-muted-foreground hover:text-muted-foreground"
                        variant="ghost"
                        size="icon"
                      >
                        <MoreVerticalIcon className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="bottom"
                      align="end"
                      className="min-w-48"
                    >
                      <DropdownMenuLabel className="text-xs">
                        {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="flex items-center justify-between text-xs">
                        <Link
                          className="flex items-center"
                          href="https://docs.integramind.ai/primitives/function"
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
              <div className="flex flex-col justify-between h-[calc(100vh-186px)]">
                <ScrollArea
                  className="h-[calc(100vh-344px)] mb-4"
                  ref={scrollAreaRef}
                >
                  <MessageList
                    messages={messages}
                    isThinking={isThinking}
                    isGenerating={isGeneratingSchemas}
                  />
                  <div ref={chatHistoryEndRef} />
                </ScrollArea>
                <div className="mt-auto">
                  <form className="relative">
                    <Editor
                      id={nanoid()}
                      editorRef={editorRef}
                      onChange={onChatChange}
                      rawMessage={userMessageRawContent}
                      placeholder="Define your flow with Specly..."
                      typeaheadPosition="bottom"
                      references={undefined}
                    />
                    <Button
                      type="button"
                      disabled={!userMessageContent || isGenerating}
                      size="sm"
                      className="absolute bottom-2 right-2 disabled:bg-muted-foreground"
                      onClick={onSubmit}
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
      <DeleteAlertDialog
        open={deleteAlertDialogOpen}
        setOpen={setDeleteAlertDialogOpen}
        onDelete={() => {
          deleteFlow.mutate({
            id: data.id,
          });
        }}
      />
    </Sheet>
  );
}
