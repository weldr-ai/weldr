"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@specly/ui/badge";
import { Button } from "@specly/ui/button";
import { Card } from "@specly/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@specly/ui/dropdown-menu";
import {
  ExpandableCard,
  ExpandableCardContent,
  ExpandableCardHeader,
  ExpandableCardTrigger,
} from "@specly/ui/expandable-card";
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
import { Handle, Position, useReactFlow } from "@xyflow/react";
import {
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2,
  PlayCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { createId } from "@paralleldrive/cuid2";
import type { Input as IInput, RoutePrimitive } from "@specly/shared/types";
import { updateRouteFlowSchema } from "@specly/shared/validators/flows";
import { Avatar, AvatarFallback, AvatarImage } from "@specly/ui/avatar";
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
import {
  gatherInputsRequirements,
  generateInputsSchemas,
} from "~/lib/ai/generator";
import { api } from "~/lib/trpc/react";
import { inputSchemaToTree } from "~/lib/utils";
import type { FlowEdge, FlowNode, FlowNodeProps } from "~/types";

export const Route = memo(
  ({
    data: _data,
    positionAbsoluteX,
    positionAbsoluteY,
    selected,
  }: FlowNodeProps) => {
    if (_data.type !== "route") {
      return;
    }

    const { data: fetchedData, refetch } = api.primitives.getById.useQuery(
      {
        id: _data.id,
      },
      {
        refetchInterval: false,
        initialData: _data,
      },
    );
    const data = fetchedData as RoutePrimitive;

    const updateRoute = api.primitives.update.useMutation({
      onSuccess: async () => {
        await refetch();
      },
    });

    const { fitBounds } = useReactFlow<FlowNode, FlowEdge>();

    const form = useForm<z.infer<typeof updateRouteFlowSchema>>({
      resolver: zodResolver(updateRouteFlowSchema),
      defaultValues: {
        name: data.name ?? undefined,
        description: data.description ?? undefined,
        method: data.metadata.method,
        path: data.metadata.path,
      },
    });

    const [isGeneratingSchemas, setIsGeneratingSchemas] = useState(false);

    const [messages, setMessages] = useState<(CoreMessage & { id: string })[]>([
      {
        id: createId(),
        role: "assistant",
        content:
          "Hello there! I'm Specly, your AI assistant. How can I help you today?",
      },
      ...(data.chatMessages?.map((message) => ({
        id: message.id,
        role: message.role === "user" ? "user" : "assistant",
        content: message.message,
      })) as (CoreMessage & { id: string })[]),
    ]);
    const [chatMessage, setChatMessage] = useState<string | null>(null);

    const addMessage = api.primitives.addMessage.useMutation({
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
        message: chatMessage,
        role: "user",
        primitiveId: data.id,
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
        message: assistantMessage,
        role: "assistant",
        primitiveId: data.id,
      });

      if (shouldGenerateSchemas) {
        setIsGeneratingSchemas(true);
        console.log("Generating schemas");
        const result = await generateInputsSchemas({
          prompt: assistantMessage,
          primitiveId: data.id,
        });

        let finalMessage = "";

        if (result) {
          finalMessage = "Successfully generated schemas";
        } else {
          finalMessage = "Failed to generate schemas";
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
          message: finalMessage,
          role: "assistant",
          primitiveId: data.id,
        });

        setIsGeneratingSchemas(false);
      }
    };

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const lastMessageRef = useRef<HTMLDivElement>(null);

    const inputTree = inputSchemaToTree((data.metadata.input as IInput) ?? {});

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    const scrollToBottom = useCallback(() => {
      if (lastMessageRef.current && scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector(
          "[data-radix-scroll-area-viewport]",
        );
        if (scrollContainer) {
          const lastMessageRect =
            lastMessageRef.current.getBoundingClientRect();
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

    return (
      <>
        <ExpandableCard>
          <ExpandableCardTrigger>
            <Card
              className={cn(
                "drag-handle flex h-[84px] w-[256px] cursor-grab flex-col gap-2 px-5 py-4",
                "hover:shadow-lg hover:shadow-black",
                {
                  "border-primary": selected,
                },
              )}
              onClick={() => {
                fitBounds(
                  {
                    x: positionAbsoluteX,
                    y: positionAbsoluteY,
                    width: 400,
                    height: 400 + 300,
                  },
                  {
                    duration: 500,
                  },
                );
              }}
            >
              <div className="flex w-full items-center gap-2 text-xs">
                <Badge>{data.metadata.method.toUpperCase()}</Badge>
                <span className="text-muted-foreground">Route</span>
              </div>
              <span className="flex w-full justify-start text-sm">
                {data.name}
              </span>
            </Card>
          </ExpandableCardTrigger>
          <ExpandableCardContent className="nowheel flex flex-col p-0 h-[600px] w-[60vw] -left-[calc(60vw-700px)]">
            <ResizablePanelGroup
              direction="horizontal"
              className="flex size-full"
            >
              <ResizablePanel defaultSize={70} minSize={20}>
                <Form {...form}>
                  <ExpandableCardHeader className="flex flex-col items-start justify-start border-b p-4">
                    <div className="flex w-full items-center justify-between">
                      <div className="flex w-full items-center gap-2">
                        <Badge variant="default" className="text-xs">
                          {data.metadata.method.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Route
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
                              Route
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-xs">
                              <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
                              Run
                            </DropdownMenuItem>
                            <DropdownMenuItem className="flex items-center justify-between text-xs">
                              <Link
                                className="flex items-center"
                                href="https://docs.specly.ai/primitives/route"
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
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              {...field}
                              autoComplete="off"
                              className="h-8 border-none shadow-none dark:bg-muted p-0 text-base focus-visible:ring-0"
                              placeholder="Route name"
                              onChange={(e) => {
                                field.onChange(e);
                                debounce(
                                  async () => {
                                    const isValid =
                                      updateRouteFlowSchema.shape.name.safeParse(
                                        e.target.value,
                                      ).success;
                                    if (isValid) {
                                      await updateRoute.mutateAsync({
                                        where: {
                                          id: data.id,
                                        },
                                        payload: {
                                          type: "route",
                                          name: e.target.value,
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
                  </ExpandableCardHeader>
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
                        <FormField
                          control={form.control}
                          name="path"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">
                                URL Path
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  autoComplete="off"
                                  placeholder="Enter action URL path"
                                  value={field.value}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    debounce(
                                      async () => {
                                        const isValid =
                                          updateRouteFlowSchema.shape.name.safeParse(
                                            e.target.value,
                                          ).success;
                                        if (isValid) {
                                          await updateRoute.mutateAsync({
                                            where: {
                                              id: data.id,
                                            },
                                            payload: {
                                              type: "route",
                                              name: e.target.value,
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
                          name="method"
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
                                      updateRouteFlowSchema.shape.method.safeParse(
                                        value,
                                      ).success;
                                    if (isValid) {
                                      await updateRoute.mutateAsync({
                                        where: {
                                          id: data.id,
                                        },
                                        payload: {
                                          type: "route",
                                          metadata: {
                                            method:
                                              value as RoutePrimitive["metadata"]["method"],
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
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">
                                Description
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  className="resize-none h-[244px]"
                                  autoComplete="off"
                                  placeholder="Enter route description"
                                  value={field.value}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    debounce(
                                      async () => {
                                        const isValid =
                                          updateRouteFlowSchema.shape.description.safeParse(
                                            e.target.value,
                                          ).success;
                                        if (isValid) {
                                          await updateRoute.mutateAsync({
                                            where: {
                                              id: data.id,
                                            },
                                            payload: {
                                              type: "route",
                                              description: e.target.value,
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
                      </div>
                    </TabsContent>
                    <TabsContent value="inputs" className="size-full">
                      <div className="flex flex-col h-[calc(100dvh-570px)]">
                        <ScrollArea className="grow mb-4" ref={scrollAreaRef}>
                          <div className="flex flex-col gap-4">
                            {messages.map((message, idx) => (
                              <>
                                {message.role === "user" ? (
                                  <div
                                    id={message.id}
                                    className="flex items-start"
                                    key={JSON.stringify(message.content)}
                                    ref={
                                      idx === messages.length - 1
                                        ? lastMessageRef
                                        : null
                                    }
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
                                    id={message.id}
                                    className="flex items-start"
                                    key={message.content as string}
                                    ref={
                                      idx === messages.length - 1
                                        ? lastMessageRef
                                        : null
                                    }
                                  >
                                    <Avatar className="size-6 rounded-md">
                                      <AvatarImage src="/logo.svg" alt="User" />
                                    </Avatar>
                                    <p className="text-sm ml-3 select-text cursor-text">
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
                          </div>
                        </ScrollArea>
                        <div className="mt-auto">
                          <form className="relative" onSubmit={onSubmit}>
                            <Textarea
                              value={chatMessage ?? ""}
                              className="min-h-[100px] max-h-[120px] resize-none"
                              placeholder="Define your route inputs with AI..."
                              onChange={(e) => {
                                setChatMessage(e.target.value);
                              }}
                              onKeyDown={(e) => {
                                if (
                                  (e.metaKey || e.ctrlKey) &&
                                  e.key === "Enter"
                                ) {
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
                                  {navigator.userAgent
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
                  </Tabs>
                </Form>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={35} minSize={20} className="p-4">
                <div className="flex flex-col size-full gap-2 bg-background rounded-lg px-4 py-3">
                  <span className="text-sm">Input</span>
                  {inputTree.length === 0 ? (
                    <div className="flex size-full text-xs items-center justify-center text-muted-foreground">
                      Chat with AI to define your route inputs
                    </div>
                  ) : (
                    <TreeView data={inputTree} />
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ExpandableCardContent>
        </ExpandableCard>
        <Handle
          type="source"
          className="border rounded-full bg-background p-1"
          position={Position.Right}
        />
      </>
    );
  },
);

Route.displayName = "Route";
