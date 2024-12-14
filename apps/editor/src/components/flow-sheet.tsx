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
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  MoreVerticalIcon,
  PanelRightCloseIcon,
  PlayCircleIcon,
  TrashIcon,
} from "lucide-react";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  AssistantMessageRawContent,
  ConversationMessage,
  FlatInputSchema,
  Flow,
  FlowInputSchemaMessage,
  FlowOutputSchemaMessage,
  UserMessageRawContent,
} from "@integramind/shared/types";
import { userMessageRawContentReferenceElementSchema } from "@integramind/shared/validators/conversations";
import {
  baseUpdateFlowSchema,
  updateEndpointFlowSchema,
  updateFlowSchema,
  updateWorkflowFlowSchema,
} from "@integramind/shared/validators/flows";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
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
import { cn } from "@integramind/ui/utils";
import { createId } from "@paralleldrive/cuid2";
import { type StreamableValue, readStreamableValue } from "ai/rsc";
import type { EditorState, LexicalEditor, ParagraphNode } from "lexical";
import { $getRoot } from "lexical";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { debounce } from "perfect-debounce";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import {
  generateFlowInputSchema,
  generateFlowOutputSchema,
} from "~/lib/ai/generator";
import { useResources } from "~/lib/context/resources";
import { api } from "~/lib/trpc/client";
import {
  assistantMessageRawContentToText,
  flattenInputSchema,
  getResourceReferences,
  jsonSchemaToTreeData,
  userMessageRawContentToText,
} from "~/lib/utils";
import { DeleteAlertDialog } from "./delete-alert-dialog";
import { Editor } from "./editor";
import type { ReferenceNode } from "./editor/plugins/reference/node";
import { JsonViewer } from "./json-viewer";
import MessageList from "./message-list";

export function FlowSheet({
  initialData,
}: {
  initialData: Flow;
}) {
  const router = useRouter();

  const { data } = api.flows.byId.useQuery(
    {
      id: initialData.id,
    },
    {
      // FIXME:
      // @ts-expect-error
      initialData,
    },
  );

  const [isOpen, setIsOpen] = useState(!data.inputSchema);

  const apiUtils = api.useUtils();

  const updateFlow = api.flows.update.useMutation({
    onSuccess: async () => {
      await apiUtils.flows.byId.invalidate();
      await apiUtils.flows.list.invalidate();
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
      case "workflow":
        return {
          ...defaultValues,
          metadata: {
            recurrence: data.metadata.recurrence,
          },
        } as z.infer<typeof updateWorkflowFlowSchema>;
    }
  };

  const editorRef = useRef<LexicalEditor>(null);

  const form = useForm<z.infer<typeof updateFlowSchema>>({
    mode: "onChange",
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

  const [isThinking, setIsThinking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSchemas, setIsGeneratingSchemas] = useState(false);
  const [generationMode, setGenerationMode] = useState<
    "input" | "output" | null
  >(!data.inputSchema ? "input" : null);

  const inputConversation = useMemo(() => {
    const messages: ConversationMessage[] = [
      {
        id: createId(),
        role: "assistant",
        content: `Hi there! I'm Integrator, your AI assistant. What are your flow's input?`,
        rawContent: [
          {
            type: "text",
            value: `Hi there! I'm Integrator, your AI assistant. What are your flow's input?`,
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
        content: `Hi there! I'm Integrator, your AI assistant. What are your flow's output?`,
        rawContent: [
          {
            type: "text",
            value: `Hi there! I'm Integrator, your AI assistant. What are your flow's output?`,
          },
        ],
      },
      ...data.outputConversation.messages.sort(
        (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
      ),
    ];

    return messages;
  }, [data.outputConversation.messages]);

  const [messages, setMessages] = useState<ConversationMessage[]>(
    !data.inputSchema ? inputConversation : [],
  );

  const [userMessageContent, setUserMessageContent] = useState<string | null>(
    null,
  );
  const [userMessageRawContent, setUserMessageRawContent] =
    useState<UserMessageRawContent>([]);

  const canGenerateSchemas = useMemo(() => {
    if (data.type === "endpoint") {
      return !!data.metadata.method && !!data.metadata.path;
    }
    if (data.type === "workflow") {
      return !!data.metadata.recurrence;
    }
    return true;
  }, [data.type, data.metadata]);

  const onSubmit = async (generationMode: "input" | "output") => {
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
      conversationId:
        generationMode === "input"
          ? data.inputConversation.id
          : data.outputConversation.id,
      createdAt: new Date(),
    };

    const newMessages: ConversationMessage[] = [...messages, newMessageUser];

    setMessages(newMessages);

    await addMessage.mutateAsync(newMessageUser);

    let result: unknown;

    if (generationMode === "input") {
      result = await generateFlowInputSchema({
        flowId: data.id,
        conversationId: data.inputConversationId,
        messages: newMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });
    } else {
      result = await generateFlowOutputSchema({
        flowId: data.id,
        conversationId: data.outputConversationId,
        messages: newMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });
    }

    if (
      typeof result === "object" &&
      "status" in (result as { status: string }) &&
      (result as { status: string }).status === "error"
    ) {
      setIsGenerating(false);
      return;
    }

    let newAssistantMessageStr = "";
    let newAssistantMessage: ConversationMessage | null = null;

    for await (const content of readStreamableValue(
      result as StreamableValue<
        FlowInputSchemaMessage | FlowOutputSchemaMessage
      >,
    )) {
      newAssistantMessage = {
        role: "assistant",
        content: "",
        rawContent: [],
        createdAt: new Date(),
      };

      if (content?.message?.content && content.message.type === "message") {
        newAssistantMessage.content = assistantMessageRawContentToText(
          content.message.content,
        );
        newAssistantMessage.rawContent = content.message.content;
        setIsThinking(false);
      }

      // if end message, start generating code
      if (
        content?.message?.type === "end" &&
        content?.message?.content?.description
      ) {
        setIsThinking(false);
        const rawContent: AssistantMessageRawContent = [
          {
            type: "text",
            value: `Generating the following ${
              generationMode === "input" ? "input" : "output"
            } schema: `,
          },
          ...content.message.content.description,
        ];

        newAssistantMessage.content =
          assistantMessageRawContentToText(rawContent);
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

      await apiUtils.flows.byId.invalidate({
        id: data.id,
      });
      setIsGeneratingSchemas(false);
      setMessages([...newMessages, schemaBuiltSuccessfullyMessage]);
    }

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

      const chat = userMessageRawContentToText(userMessageRawContent, {
        includeDatabaseInfo: false,
      });
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

  const [flowTestResponse, _setFlowTestResponse] = useState<string | null>(
    null,
  );
  const [isRunning, setIsRunning] = useState(false);

  const [openTab, setOpenTab] = useState<"general" | "build" | "run">(
    !data.inputSchema ? "build" : "general",
  );

  const resources = useResources();

  const { data: flowFuncs } = api.flows.funcs.useQuery({
    flowId: data.id,
  });

  const references = useMemo(() => {
    if (generationMode === "input") {
      return [...getResourceReferences(resources, ["database"])];
    }

    if (!flowFuncs) {
      return [];
    }

    const outputs = flowFuncs.reduce((acc, d) => {
      acc.push(
        ...flattenInputSchema({
          id: d.id,
          schema: d.outputSchema ?? undefined,
          refPath: `local/${d.id}/output`,
          sourceFuncId: d.id,
        }),
      );
      return acc;
    }, [] as FlatInputSchema[]);

    const flowInputs = flattenInputSchema({
      id: data.id,
      schema: data.inputSchema ?? undefined,
      refPath: `${data.type}/input`,
      sourceFuncId: data.id,
    });

    return [
      ...outputs.map((output) => ({
        type: "reference" as const,
        referenceType: "variable" as const,
        name: output.path,
        required: output.required,
        dataType: output.type,
        refUri: output.refUri,
        properties: output.properties,
        itemsType: output.itemsType,
        sourceFuncId: output.sourceFuncId,
      })),
      ...flowInputs.map((input) => ({
        type: "reference" as const,
        referenceType: "variable" as const,
        name: input.path,
        required: input.required,
        dataType: input.type,
        refUri: input.refUri,
      })),
    ];
  }, [
    flowFuncs,
    resources,
    generationMode,
    data.id,
    data.inputSchema,
    data.type,
  ]);

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        // Only allow closing if input schema exists
        if (data.inputSchema || open) {
          setIsOpen(open);
        }
      }}
      modal={false}
    >
      <SheetTrigger asChild>
        <Button
          className="rounded-full gap-2 text-xs"
          variant="ghost"
          disabled={!data.inputSchema}
        >
          {!data.canRun && (
            <AlertCircleIcon className="size-4 text-destructive" />
          )}
          <Badge
            variant="outline"
            className={cn("text-xs border-transparent", {
              "text-primary bg-primary/15":
                data.type === "endpoint" && data.metadata.method === "get",
              "text-success bg-success/15":
                data.type === "endpoint" && data.metadata.method === "post",
              "text-warning bg-warning/15":
                data.type === "endpoint" && data.metadata.method === "patch",
              "text-destructive bg-destructive/15":
                data.type === "endpoint" && data.metadata.method === "delete",
            })}
          >
            {data.type === "endpoint"
              ? data.metadata.method.toUpperCase()
              : data.type.charAt(0).toUpperCase() + data.type.slice(1)}
          </Badge>
          <span>{data.name}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="p-0 bg-muted border rounded-lg top-2 right-2 h-[calc(100vh-16px)] min-w-[700px]">
        <Form {...form}>
          <SheetHeader>
            <SheetTitle className="flex flex-col items-start justify-start border-b p-4">
              <div className="flex w-full items-center justify-between">
                <div className="flex w-full items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("text-xs border-transparent", {
                      "text-primary bg-primary/15":
                        data.type === "endpoint" &&
                        data.metadata.method === "get",
                      "text-success bg-success/15":
                        data.type === "endpoint" &&
                        data.metadata.method === "post",
                      "text-warning bg-warning/15":
                        data.type === "endpoint" &&
                        data.metadata.method === "patch",
                      "text-destructive bg-destructive/15":
                        data.type === "endpoint" &&
                        data.metadata.method === "delete",
                    })}
                  >
                    {data.type === "endpoint"
                      ? data.metadata.method.toUpperCase()
                      : data.type.charAt(0).toUpperCase() + data.type.slice(1)}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
                    </span>
                    {!data.canRun && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertCircleIcon className="size-3.5 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="bg-muted border text-destructive"
                        >
                          <p>
                            {!data.inputSchema
                              ? `Define the ${data.type} inputs first`
                              : `Define the ${data.type} outputs first`}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="size-7 text-success hover:text-success"
                        variant="ghost"
                        size="icon"
                        disabled={!data.canRun}
                        onClick={async () => {
                          setOpenTab("run");
                          setIsRunning(true);
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
                disabled={!data.canRun}
                onClick={() => setOpenTab("run")}
              >
                Run
              </TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="size-full">
              <div className="flex flex-col gap-2">
                {data.type === "endpoint" && (
                  <div className="grid grid-cols-3 gap-2">
                    <FormField
                      control={form.control}
                      name="payload.metadata.path"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
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
                        <FormItem className="col-span-1">
                          <FormLabel className="text-xs">Method</FormLabel>
                          <FormControl>
                            <Select
                              {...field}
                              autoComplete="off"
                              name={field.name}
                              onValueChange={async (value) => {
                                console.log(value);
                                field.onChange(value);
                                const isValid =
                                  updateEndpointFlowSchema.shape.metadata.safeParse(
                                    {
                                      method: value,
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
                  </div>
                )}
                {data.type === "workflow" && (
                  <FormField
                    control={form.control}
                    name="payload.metadata.recurrence"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Recurrence</FormLabel>
                        <FormControl>
                          <Select
                            {...field}
                            name={field.name}
                            onValueChange={async (value) => {
                              field.onChange(value);
                              const isValid =
                                updateWorkflowFlowSchema.shape.metadata.safeParse(
                                  {
                                    recurrence: value,
                                  },
                                ).success;
                              if (isValid) {
                                await updateFlow.mutateAsync({
                                  where: { id: data.id },
                                  payload: {
                                    type: "workflow",
                                    metadata: {
                                      recurrence: value as
                                        | "hourly"
                                        | "daily"
                                        | "weekly"
                                        | "monthly",
                                    },
                                  },
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Select recurrence" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hourly">Hourly</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {data.inputSchema ? (
                  <>
                    <span className="text-xs">Summary</span>
                    <div className="flex flex-col gap-2">
                      {data.description && (
                        <>
                          <span className="text-xs text-muted-foreground">
                            Description
                          </span>
                          <p className="text-sm">{data.description}</p>
                        </>
                      )}
                      {data.inputSchema && (
                        <>
                          <span className="text-xs text-muted-foreground">
                            Input Schema
                          </span>
                          <TreeView
                            data={jsonSchemaToTreeData(data.inputSchema)}
                          />
                        </>
                      )}
                      {data.outputSchema && (
                        <>
                          <span className="text-xs text-muted-foreground">
                            Output Schema
                          </span>
                          <TreeView
                            data={jsonSchemaToTreeData(data.outputSchema)}
                          />
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col justify-center items-center h-[calc(100vh-320px)]">
                    <span className="text-sm text-muted-foreground">
                      Build your {data.type} to see a summary
                    </span>
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="build" className="size-full">
              {generationMode === null && (
                <div className="flex flex-col w-full h-[calc(100vh-250px)] justify-center items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Choose Integrator's mode
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
                        Define your {generationMode} with Integrator
                      </p>
                    </div>
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
                  </div>
                  <div className="mt-auto">
                    <form className="relative">
                      <Editor
                        id={nanoid()}
                        editorRef={editorRef}
                        onChange={onChatChange}
                        rawMessage={userMessageRawContent}
                        placeholder={`Define your ${data.type} ${generationMode} with Specly...`}
                        typeaheadPosition="bottom"
                        references={references}
                        onSubmit={async () => {
                          if (userMessageContent && !isGenerating) {
                            await onSubmit(generationMode);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        disabled={
                          !userMessageContent ||
                          isGenerating ||
                          !canGenerateSchemas
                        }
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
            {data.canRun && (
              <TabsContent value="run" className="size-full">
                <div className="flex flex-col gap-2 bg-background p-4 rounded-lg h-[calc(100vh-186px)]">
                  {isRunning ? (
                    <div className="flex flex-col size-full items-center justify-center gap-2">
                      <Loader2Icon className="size-3.5 animate-spin" />
                      <p className="text-xs text-muted-foreground">
                        Running...
                      </p>
                    </div>
                  ) : (
                    <JsonViewer data={flowTestResponse} />
                  )}
                </div>
              </TabsContent>
            )}
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
