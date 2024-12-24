import { zodResolver } from "@hookform/resolvers/zod";
import type { RouterOutputs } from "@integramind/api";
import type {
  AssistantMessageRawContent,
  ConversationMessage,
  FuncRequirementsMessage,
  UserMessageRawContent,
} from "@integramind/shared/types";
import { userMessageRawContentReferenceElementSchema } from "@integramind/shared/validators/conversations";
import {
  endpointPathSchema,
  httpMethodsSchema,
} from "@integramind/shared/validators/endpoints";
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
import { z } from "zod";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { Editor } from "~/components/editor";
import type { ReferenceNode } from "~/components/editor/plugins/reference/node";
import MessageList from "~/components/message-list";
import OpenApiEndpointDocs from "~/components/openapi-endpoint-docs";
import { generateFunc } from "~/lib/ai/generator";
import { useFlowBuilderStore } from "~/lib/store";
import { api } from "~/lib/trpc/client";
import type { CanvasNodeProps } from "~/types";

const validationSchema = z.object({
  name: z.string().min(1, {
    message: "Name is required",
  }),
  path: endpointPathSchema,
  httpMethod: httpMethodsSchema,
});

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

    const { deleteElements, fitBounds } = useReactFlow();
    const apiUtils = api.useUtils();

    const deleteEndpoint = api.endpoints.delete.useMutation({
      onSuccess: async () => {
        await apiUtils.projects.byId.invalidate({ id: data.projectId });
      },
    });

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

    const updateEndpoint = api.endpoints.update.useMutation({
      onSuccess: async () => {
        await apiUtils.endpoints.byId.invalidate({ id: data.id });
      },
    });

    const form = useForm<z.infer<typeof validationSchema>>({
      mode: "onChange",
      resolver: zodResolver(validationSchema),
      defaultValues: {
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
    });

    useEffect(() => {
      if (!data.name) {
        form.setError("name", {
          message: "Name is required",
        });
      }

      if (!data.path) {
        form.setError("path", {
          message: "Path is required",
        });
      }

      if (!data.httpMethod) {
        form.setError("httpMethod", {
          message: "HTTP Method is required",
        });
      }
    }, [form, data.name, data.path, data.httpMethod]);

    const debouncedUpdate = useMemo(
      () =>
        debounce(
          async (values: z.infer<typeof validationSchema>) => {
            await updateEndpoint.mutateAsync({
              where: { id: data.id },
              payload: values,
            });
          },
          500,
          { trailing: false },
        ),
      [data.id, updateEndpoint],
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
                      <span
                        className={cn(
                          "text-xs uppercase font-bold px-1.5 py-0.5 rounded-sm",
                          {
                            "bg-primary/30 text-primary":
                              data.httpMethod === "get",
                            "bg-success/30 text-success":
                              data.httpMethod === "post",
                            "bg-warning/30 text-warning":
                              data.httpMethod === "put",
                            "bg-destructive/30 text-destructive":
                              data.httpMethod === "delete",
                            "text-primary text-xs font-semibold p-0":
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
                defaultSize={50}
                minSize={30}
                className="flex flex-col"
              >
                <div className="flex flex-col items-start justify-start p-4 border-b">
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-primary text-xs font-semibold">
                        API
                      </span>
                      <span className="text-muted-foreground">Endpoint</span>
                    </div>
                  </div>
                  <Form {...form}>
                    <form onChange={form.handleSubmit(onFormChange)}>
                      <div className="flex flex-col gap-0 w-full">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="flex w-full space-y-0">
                              <FormControl>
                                <Input
                                  {...field}
                                  autoComplete="off"
                                  className="h-8 w-full border-none shadow-none dark:bg-muted p-0 text-base focus-visible:ring-0"
                                  placeholder="Enter endpoint name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="path"
                          render={({ field }) => (
                            <FormItem className="flex-1 space-y-0">
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
                                      className="h-8 border-none shadow-none dark:bg-muted p-0 text-xs focus-visible:ring-0"
                                      placeholder="/api/v1/resource"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1 text-xs text-destructive">
                                    {form.formState.errors.path && (
                                      <span>
                                        {form.formState.errors.path.message}
                                      </span>
                                    )}
                                    {form.formState.errors.httpMethod && (
                                      <span>
                                        {
                                          form.formState.errors.httpMethod
                                            .message
                                        }
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </form>
                  </Form>
                </div>
                <div className="flex flex-col h-[calc(100dvh-492px)] p-4">
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
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={50} minSize={30}>
                <ScrollArea className="h-full p-4">
                  {!data.httpMethod || !data.path || !data.name ? (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-sm text-muted-foreground">
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
  form: UseFormReturn<z.infer<typeof validationSchema>>;
}) => {
  const [isSelecting, setIsSelecting] = useState(false);

  const badgeClassNames = (methodValue?: string) =>
    cn("uppercase font-bold px-1.5 py-0.5", {
      "bg-primary/30 hover:bg-primary/40 text-primary":
        methodValue?.toLowerCase() === "get",
      "bg-success/30 hover:bg-success/40 text-success":
        methodValue?.toLowerCase() === "post",
      "bg-warning/30 hover:bg-warning/40 text-warning":
        methodValue?.toLowerCase() === "put" ||
        methodValue?.toLowerCase() === "patch",
      "bg-destructive/30 hover:bg-destructive/40 text-destructive":
        methodValue?.toLowerCase() === "delete",
    });

  return (
    <FormField
      control={form.control}
      name="httpMethod"
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
                  "h-full px-2.5 py-0.5 rounded-sm border-none shadow-none focus:ring-0 text-xs items-center justify-center",
                  value
                    ? badgeClassNames(value)
                    : "bg-accent rounded-sm text-muted-foreground hover:bg-accent/80",
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
