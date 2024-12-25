import { DeleteAlertDialog } from "@/components/delete-alert-dialog";
import { Editor } from "@/components/editor";
import type { ReferenceNode } from "@/components/editor/plugins/reference/node";
import MessageList from "@/components/message-list";
import OpenApiEndpointDocs from "@/components/openapi-endpoint-docs";
import { generateFunc } from "@/lib/ai/generator";
import { useFlowBuilderStore } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import type { CanvasNode, CanvasNodeProps } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import type { RouterOutputs } from "@integramind/api";
import type {
  AssistantMessageRawContent,
  ConversationMessage,
  FuncRequirementsMessage,
  UserMessageRawContent,
} from "@integramind/shared/types";
import { userMessageRawContentReferenceElementSchema } from "@integramind/shared/validators/conversations";
import { updateEndpointSchema } from "@integramind/shared/validators/endpoints";
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
  ExpandableCardTrigger,
} from "@integramind/ui/expandable-card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@integramind/ui/form";
import { toast } from "@integramind/ui/hooks/use-toast";
import { Input } from "@integramind/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@integramind/ui/resizable";
import { ScrollArea } from "@integramind/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@integramind/ui/select";
import { cn } from "@integramind/ui/utils";
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
import { debounce } from "perfect-debounce";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
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

    const { deleteElements, fitBounds, updateNodeData } =
      useReactFlow<CanvasNode>();

    const apiUtils = api.useUtils();

    const updateEndpoint = api.endpoints.update.useMutation({
      onSuccess: async (data) => {
        await apiUtils.endpoints.byId.invalidate({ id: data.id });
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

    const deleteEndpoint = api.endpoints.delete.useMutation();

    const addMessage = api.conversations.addMessage.useMutation();

    const editorRef = useRef<LexicalEditor>(null);

    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);
    const [isThinking, setIsThinking] = useState<boolean>(false);
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
      ...(data.conversation?.messages ?? []),
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

        await apiUtils.endpoints.byId.invalidate({ id: data.id });
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

    const showEdges = useFlowBuilderStore((state) => state.showEdges);

    const form = useForm<z.infer<typeof updateEndpointSchema>>({
      mode: "onChange",
      resolver: zodResolver(updateEndpointSchema),
      defaultValues: {
        where: {
          id: data.id,
        },
        payload: {
          name: data.name ?? "",
          path: data.path ?? "",
          httpMethod:
            (data.httpMethod?.toLowerCase() as
              | "get"
              | "post"
              | "put"
              | "delete"
              | "patch") ?? undefined,
        },
      },
    });

    useEffect(() => {
      if (!data.name) {
        form.setError("payload.name", {
          message: "Name is required",
        });
      }

      if (!data.path) {
        form.setError("payload.path", {
          message: "Path is required",
        });
      }

      if (!data.httpMethod) {
        form.setError("payload.httpMethod", {
          message: "HTTP Method is required",
        });
      }
    }, [form, data.name, data.path, data.httpMethod]);

    const debouncedUpdate = useMemo(
      () =>
        debounce(
          async (values: z.infer<typeof updateEndpointSchema>) => {
            await updateEndpoint.mutateAsync({
              where: { id: data.id },
              payload: values.payload,
            });
          },
          500,
          { trailing: false },
        ),
      [data.id, updateEndpoint],
    );

    const onFormChange = (values: z.infer<typeof updateEndpointSchema>) => {
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
                      <span
                        className={cn(
                          "rounded-sm px-1.5 py-0.5 font-bold text-xs uppercase",
                          {
                            "bg-primary/30 text-primary":
                              data.httpMethod === "get",
                            "bg-success/30 text-success":
                              data.httpMethod === "post",
                            "bg-warning/30 text-warning":
                              data.httpMethod === "put",
                            "bg-destructive/30 text-destructive":
                              data.httpMethod === "delete",
                            "p-0 font-semibold text-primary text-xs":
                              !data.httpMethod,
                          },
                        )}
                      >
                        {data.httpMethod?.toUpperCase() ?? "API"}
                      </span>
                      <span className="text-muted-foreground">Endpoint</span>
                    </div>
                    {!data.openApiSpec && (
                      <CircleAlertIcon className="size-4 text-destructive" />
                    )}
                  </div>
                  <span className="text-sm">{data.name ?? "newEndpoint"}</span>
                </Card>
              </ExpandableCardTrigger>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuLabel className="text-xs">Endpoint</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem className="flex items-center justify-between text-xs">
                <Link
                  className="flex items-center"
                  href="https://docs.integramind.ai/endpoints"
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
                defaultSize={50}
                minSize={30}
                className="flex flex-col"
              >
                <div className="flex flex-col items-start justify-start border-b p-4">
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-primary text-xs">
                        API
                      </span>
                      <span className="text-muted-foreground">Endpoint</span>
                    </div>
                  </div>
                  <Form {...form}>
                    <form
                      className="w-full"
                      onChange={form.handleSubmit(onFormChange)}
                    >
                      <FormField
                        control={form.control}
                        name="payload.name"
                        render={({ field }) => (
                          <FormItem className="w-full space-y-0">
                            <FormControl>
                              <Input
                                {...field}
                                autoComplete="off"
                                className="h-8 w-full border-none p-0 text-base shadow-none focus-visible:ring-0 dark:bg-muted"
                                placeholder="Enter endpoint name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="payload.path"
                        render={({ field }) => (
                          <FormItem className="w-full flex-1 space-y-0">
                            <FormControl>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <MethodBadgeSelect
                                    form={form}
                                    value={data.httpMethod}
                                    onValueChange={async (value) => {
                                      await updateEndpoint.mutateAsync({
                                        where: { id: data.id },
                                        payload: {
                                          httpMethod: value as
                                            | "get"
                                            | "post"
                                            | "put"
                                            | "delete"
                                            | "patch",
                                        },
                                      });
                                    }}
                                  />
                                  <Input
                                    {...field}
                                    autoComplete="off"
                                    className="h-8 border-none p-0 text-xs shadow-none focus-visible:ring-0 dark:bg-muted"
                                    placeholder="/api/v1/resource"
                                  />
                                </div>
                                <div className="flex flex-col gap-1 text-destructive text-xs">
                                  {form.formState.errors.payload?.path && (
                                    <span>
                                      {
                                        form.formState.errors.payload?.path
                                          .message
                                      }
                                    </span>
                                  )}
                                  {form.formState.errors.payload
                                    ?.httpMethod && (
                                    <span>
                                      {
                                        form.formState.errors.payload
                                          ?.httpMethod.message
                                      }
                                    </span>
                                  )}
                                </div>
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </form>
                  </Form>
                </div>
                <div className="flex h-[calc(100dvh-492px)] flex-col p-4">
                  <ScrollArea className="mb-4 flex-grow" ref={scrollAreaRef}>
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
                      id={data.id}
                      references={[]}
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

              <ResizablePanel defaultSize={50} minSize={30}>
                <ScrollArea className="h-full p-4">
                  {!data.httpMethod || !data.path || !data.name ? (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-muted-foreground text-sm">
                        Develop your endpoint to see summary
                      </span>
                    </div>
                  ) : (
                    <OpenApiEndpointDocs
                      spec={
                        data.openApiSpec &&
                        Object.keys(data.openApiSpec).length > 0
                          ? (data.openApiSpec as OpenAPIV3.Document)
                          : ({
                              openapi: "3.0.0",
                              info: {
                                title: "Sample API",
                                version: "1.0.0",
                              },
                              paths: {
                                [data.path]: {
                                  [data.httpMethod.toLowerCase()]: {
                                    summary: data.name,
                                    description: data.description,
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
                                                description:
                                                  "Username of the account",
                                              },
                                              ticker: {
                                                type: "string",
                                                description:
                                                  "Stock ticker symbol",
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
                                                  description:
                                                    "Number of stocks",
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
          onDelete={() => {
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

const MethodBadgeSelect = ({
  value,
  onValueChange,
  form,
}: {
  value?: string | null;
  onValueChange: (value: string) => void;
  form: UseFormReturn<z.infer<typeof updateEndpointSchema>>;
}) => {
  const [isSelecting, setIsSelecting] = useState(false);

  const badgeClassNames = (methodValue?: string) =>
    cn("px-1.5 py-0.5 font-bold uppercase", {
      "bg-primary/30 text-primary hover:bg-primary/40":
        methodValue?.toLowerCase() === "get",
      "bg-success/30 text-success hover:bg-success/40":
        methodValue?.toLowerCase() === "post",
      "bg-warning/30 text-warning hover:bg-warning/40":
        methodValue?.toLowerCase() === "put" ||
        methodValue?.toLowerCase() === "patch",
      "bg-destructive/30 text-destructive hover:bg-destructive/40":
        methodValue?.toLowerCase() === "delete",
    });

  return (
    <FormField
      control={form.control}
      name="payload.httpMethod"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Select
              {...field}
              open={isSelecting}
              value={value?.toLowerCase() || ""}
              onValueChange={(v) => {
                field.onChange(v);
                onValueChange(v);
                setIsSelecting(false);
              }}
              onOpenChange={setIsSelecting}
            >
              <SelectTrigger
                showIcon={false}
                onClick={() => setIsSelecting(true)}
                className={cn(
                  "h-full items-center justify-center rounded-sm border-none px-2.5 py-0.5 text-xs shadow-none focus:ring-0",
                  value
                    ? badgeClassNames(value)
                    : "rounded-sm bg-accent text-muted-foreground hover:bg-accent/80",
                )}
              >
                <SelectValue className="text-xs" placeholder="HTTP METHOD" />
              </SelectTrigger>
              <SelectContent className="w-14">
                <SelectItem value="get">GET</SelectItem>
                <SelectItem value="post">POST</SelectItem>
                <SelectItem value="put">PUT</SelectItem>
                <SelectItem value="delete">DELETE</SelectItem>
                <SelectItem value="patch">PATCH</SelectItem>
              </SelectContent>
            </Select>
          </FormControl>
        </FormItem>
      )}
    />
  );
};
