"use client";

import { Badge } from "@specly/ui/badge";
import { Button } from "@specly/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@specly/ui/dropdown-menu";
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
import { cn } from "@specly/ui/utils";
import {
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2,
  PlayCircleIcon,
} from "lucide-react";
import Link from "next/link";

import { zodResolver } from "@hookform/resolvers/zod";
import { createId } from "@paralleldrive/cuid2";
import type { Flow, InputSchema } from "@specly/shared/types";
import {
  baseUpdateFlowSchema,
  updateEndpointFlowSchema,
  updateFlowSchema,
  type updateTaskFlowSchema,
} from "@specly/shared/validators/flows";
import { Avatar, AvatarFallback, AvatarImage } from "@specly/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@specly/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@specly/ui/resizable";
import { ScrollArea } from "@specly/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@specly/ui/tabs";
import { TreeView } from "@specly/ui/tree-view";
import type { CoreMessage } from "ai";
import { readStreamableValue } from "ai/rsc";
import { debounce } from "perfect-debounce";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import {
  gatherInputsRequirements,
  generateFlowInputsSchemas,
} from "~/lib/ai/generator";
import { api } from "~/lib/trpc/react";
import { inputSchemaToTreeData } from "~/lib/utils";

export function FlowDialog({ initialData }: { initialData: Flow }) {
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
      refetch();
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

  const inputTree = inputSchemaToTreeData(data.inputSchema as InputSchema);

  const [isGeneratingSchemas, setIsGeneratingSchemas] = useState(false);

  const savedMessages = data.conversation.messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
  }));

  const [messages, setMessages] = useState<(CoreMessage & { id: string })[]>([
    {
      id: createId(),
      role: "assistant",
      content:
        "Hello there! I'm Specly, your AI builder. What can I build for you today?",
    },
    ...savedMessages,
  ]);

  const [chatMessage, setChatMessage] = useState<string | null>(null);

  const addMessage = api.conversations.addMessage.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!chatMessage) {
      return;
    }

    const newMessages: (CoreMessage & { id: string })[] = [
      ...messages,
      {
        id: createId(),
        role: "user",
        content: chatMessage,
      },
    ];

    setMessages(newMessages);
    setChatMessage(null);

    await addMessage.mutateAsync({
      content: chatMessage,
      role: "user",
      conversationId: data.conversation.id,
    });

    const result = await gatherInputsRequirements(
      newMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })) as CoreMessage[],
    );

    let assistantMessage = "";

    let shouldGenerateSchemas = false;

    for await (const content of readStreamableValue(result)) {
      assistantMessage = content as string;
      if (assistantMessage.trim().endsWith("END")) {
        assistantMessage = `Generating the following schema: ${assistantMessage.replace("END", "")}`;
        shouldGenerateSchemas = true;
      }
      setMessages([
        ...newMessages,
        {
          id: createId(),
          role: "assistant",
          content: assistantMessage,
        },
      ]);
    }

    await addMessage.mutateAsync({
      content: assistantMessage,
      role: "assistant",
      conversationId: data.conversation.id,
    });

    if (shouldGenerateSchemas) {
      setIsGeneratingSchemas(true);
      const result = await generateFlowInputsSchemas({
        prompt: assistantMessage,
        flowId: data.id,
        flowType: data.type,
      });

      let finalMessage = "";

      if (result) {
        finalMessage = "Successfully generated input schema";
      } else {
        finalMessage = "Failed to generate input schema";
      }

      setMessages([
        ...newMessages,
        {
          id: createId(),
          role: "assistant",
          content: finalMessage,
        },
      ]);

      await addMessage.mutateAsync({
        content: finalMessage,
        role: "assistant",
        conversationId: data.conversation.id,
      });

      setIsGeneratingSchemas(false);
    }
  };

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
    <Dialog>
      <DialogTrigger asChild>
        <Button className="rounded-full gap-2 text-xs" variant="ghost">
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
      </DialogTrigger>
      <DialogContent className="p-0 max-w-4xl">
        <ResizablePanelGroup direction="horizontal" className="flex size-full">
          <ResizablePanel defaultSize={70} minSize={20}>
            <Form {...form}>
              <DialogHeader>
                <DialogTitle className="flex flex-col items-start justify-start border-b p-4">
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
                      <Button
                        className="size-7 text-success hover:text-success"
                        variant="ghost"
                        size="icon"
                      >
                        <PlayCircleIcon className="size-3.5" />
                      </Button>
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
                            {data.type.charAt(0).toUpperCase() +
                              data.type.slice(1)}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-xs">
                            <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
                            Run
                          </DropdownMenuItem>
                          <DropdownMenuItem className="flex items-center justify-between text-xs">
                            <Link
                              className="flex items-center"
                              href={`https://docs.specly.ai/primitives/${data.type}}`}
                              target="blank"
                            >
                              <FileTextIcon className="mr-3 size-4 text-muted-foreground" />
                              Docs
                            </Link>
                            <ExternalLinkIcon className="size-3 text-muted-foreground" />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                            className="h-8 border-none shadow-none p-0 text-base focus-visible:ring-0"
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
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="general" className="p-4 w-full">
                <TabsList className="w-full justify-start bg-accent">
                  <TabsTrigger className="w-full" value="general">
                    General
                  </TabsTrigger>
                  <TabsTrigger className="w-full" value="inputs">
                    Inputs
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
                              <FormLabel className="text-xs">
                                URL Path
                              </FormLabel>
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
                                    <SelectItem value="delete">
                                      DELETE
                                    </SelectItem>
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
                  <div className="flex flex-col h-[calc(100dvh-570px)]">
                    <ScrollArea className="grow mb-4" ref={scrollAreaRef}>
                      <div className="flex flex-col gap-4">
                        {messages.map((message) => (
                          <>
                            {message.role === "user" ? (
                              <div
                                key={message.id}
                                className="flex items-start"
                              >
                                <Avatar className="size-6 rounded-md">
                                  <AvatarImage src={undefined} alt="User" />
                                  <AvatarFallback>
                                    <div className="size-full bg-gradient-to-br from-rose-500 via-amber-600 to-blue-500" />
                                  </AvatarFallback>
                                </Avatar>
                                <p className="text-sm ml-3 select-text cursor-text">
                                  {message.content as string}
                                </p>
                              </div>
                            ) : (
                              <div
                                key={message.id}
                                className="flex items-start"
                              >
                                <Avatar className="size-6 rounded-md">
                                  <AvatarImage src="/logo.svg" alt="User" />
                                </Avatar>
                                <p
                                  className={cn(
                                    "text-sm ml-3 select-text cursor-text",
                                    {
                                      "text-success":
                                        message.content ===
                                        "Successfully generated input schema",
                                      "text-destructive":
                                        message.content ===
                                        "Failed to generate input schema",
                                    },
                                  )}
                                >
                                  {message.content as string}
                                </p>
                              </div>
                            )}
                          </>
                        ))}
                        {isGeneratingSchemas && (
                          <div className="flex items-center justify-center">
                            <Loader2 className="size-4 animate-spin" />
                          </div>
                        )}
                        <div ref={chatHistoryEndRef} />
                      </div>
                    </ScrollArea>
                    <div className="mt-auto">
                      <form className="relative" onSubmit={onSubmit}>
                        <Textarea
                          value={chatMessage ?? ""}
                          className="min-h-[100px] max-h-[120px] resize-none"
                          placeholder={`Define your ${data.type} inputs with AI...`}
                          onChange={(e) => {
                            setChatMessage(e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                              e.preventDefault();
                              e.currentTarget.form?.requestSubmit();
                            }
                          }}
                        />
                        <Button
                          type="submit"
                          disabled={!chatMessage}
                          size="sm"
                          className="absolute bottom-2 right-2 disabled:bg-muted-foreground"
                        >
                          Send
                          <span className="ml-1">
                            <span className="px-1 py-0.5 bg-white/20 rounded-sm disabled:text-muted-foreground">
                              {/* {navigator.userAgent.toLowerCase().includes("mac")
                                ? "⌘"
                                : "Ctrl"} */}
                              ⏎
                            </span>
                          </span>
                        </Button>
                      </form>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </Form>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={35} minSize={20} className="p-4">
            <div className="flex flex-col size-full gap-2 bg-background rounded-lg px-4 py-3">
              <span className="text-sm">Input</span>
              {inputTree.length === 0 ? (
                <div className="flex size-full text-xs items-center justify-center text-muted-foreground">
                  Chat with Specly to define your {data.type} inputs
                </div>
              ) : (
                <TreeView data={inputTree} expandAll={true} />
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </DialogContent>
    </Dialog>
  );
}
