import { Handle, Position, useReactFlow } from "@xyflow/react";
import {
  CornerDownLeftIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PlayCircleIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { memo, useState } from "react";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
import {
  ExpandableCard,
  ExpandableCardContent,
  ExpandableCardHeader,
  ExpandableCardTrigger,
} from "@integramind/ui/expandable-card";
import { cn } from "@integramind/ui/utils";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  RawDescription,
  ResponsePrimitive,
} from "@integramind/shared/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@integramind/ui/form";
import { Input } from "@integramind/ui/input";
import { $getRoot, type EditorState, type ParagraphNode } from "lexical";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import Editor from "~/components/editor";
import type { ReferenceNode } from "~/components/editor/nodes/reference-node";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode, FlowNodeProps } from "~/types";

export const validationSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required",
    })
    .regex(/^[a-z0-9_]+$/, {
      message:
        "Name must only contain lowercase letters, numbers, and underscores",
    })
    .regex(/^[a-z0-9].*[a-z0-9]$/, {
      message: "Name must not start or end with an underscore",
    })
    .regex(/^(?!.*__).*$/, {
      message: "Name must not contain consecutive underscores",
    }),
  description: z.string().min(1, {
    message: "Description is required",
  }),
});

export const Response = memo(
  ({
    data: _data,
    positionAbsoluteX,
    positionAbsoluteY,
    selected,
  }: FlowNodeProps) => {
    const reactFlow = useReactFlow<FlowNode, FlowEdge>();
    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);

    const { data: fetchedData, refetch } = api.primitives.getById.useQuery(
      {
        id: _data.id,
      },
      {
        refetchInterval: 5 * 60 * 1000,
        initialData: _data,
      },
    );
    const data = fetchedData as ResponsePrimitive;

    const deleteResponse = api.primitives.delete.useMutation();

    const updateResponse = api.primitives.update.useMutation({
      onSuccess: async () => {
        await refetch();
      },
    });

    const form = useForm<z.infer<typeof validationSchema>>({
      mode: "all",
      criteriaMode: "all",
      reValidateMode: "onChange",
      resolver: zodResolver(validationSchema),
      defaultValues: {
        name: data.name ?? undefined,
        description: data.description ?? undefined,
      },
    });

    function onChange(editorState: EditorState) {
      editorState.read(async () => {
        const root = $getRoot();
        const children = (root.getChildren()[0] as ParagraphNode).getChildren();

        const description = root.getTextContent();
        const rawDescription = children.reduce((acc, child) => {
          if (child.__type === "text") {
            acc.push({
              type: "text",
              value: child.getTextContent(),
            });
          } else if (child.__type === "reference") {
            const referenceNode = child as ReferenceNode;
            acc.push({
              type: "reference",
              id: referenceNode.__id,
              referenceType: referenceNode.__referenceType,
              name: referenceNode.__name,
              icon: referenceNode.__icon,
              dataType: referenceNode.__dataType,
              testValue: referenceNode.__testValue ?? null,
            });
          }
          return acc;
        }, [] as RawDescription[]);

        updateResponse.mutate({
          where: {
            id: data.id,
            flowId: data.flowId,
          },
          payload: {
            type: "response",
            description,
            metadata: {
              rawDescription,
            },
          },
        });
      });
    }

    return (
      <>
        <ExpandableCard>
          <ContextMenu>
            <ContextMenuTrigger>
              <ExpandableCardTrigger>
                <Card
                  className={cn(
                    "drag-handle flex h-[84px] w-[256px] cursor-grab flex-col items-start gap-2 bg-background px-5  py-4 dark:bg-muted",
                    {
                      "border-primary": selected,
                    },
                  )}
                  onClick={() => {
                    reactFlow.fitBounds(
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
                  <div className="flex items-center gap-2 text-xs">
                    <CornerDownLeftIcon className="size-4 text-primary" />
                    <span className="text-muted-foreground">Response</span>
                  </div>
                  <span className="text-sm">
                    {data.name ?? "response_name"}
                  </span>
                </Card>
              </ExpandableCardTrigger>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuLabel className="text-xs">Response</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem className="text-xs">
                <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
                Run with previous primitives
              </ContextMenuItem>
              <ContextMenuItem className="flex items-center justify-between text-xs">
                <Link
                  className="flex items-center"
                  href="https://docs.integramind.ai/primitives/iterator"
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
          <ExpandableCardContent className="nowheel flex h-[400px] flex-col p-0">
            <ExpandableCardHeader className="flex flex-col items-start justify-start px-4 pt-4">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <CornerDownLeftIcon className="size-4 text-primary" />
                  <span className="text-muted-foreground">Response</span>
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
                    <DropdownMenuTrigger>
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
                        Response
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-xs">
                        <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
                        Run with previous primitives
                      </DropdownMenuItem>
                      <DropdownMenuItem className="flex items-center justify-between text-xs">
                        <Link
                          className="flex items-center"
                          href="https://docs.integramind.ai/primitives/response"
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
                </div>
              </div>
            </ExpandableCardHeader>
            <div className="flex flex-col h-full gap-6 pb-4">
              <Form {...form}>
                <div className="flex flex-col h-full gap-6 px-4">
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
                            placeholder="response_name"
                            onBlur={(e) => {
                              field.onChange(e);
                              const isValid =
                                validationSchema.shape.name.safeParse(
                                  e.target.value,
                                ).success;
                              if (isValid) {
                                updateResponse.mutate({
                                  where: {
                                    id: data.id,
                                    flowId: data.flowId,
                                  },
                                  payload: {
                                    type: "function",
                                    name: e.target.value,
                                    metadata: {
                                      isCodeUpdated:
                                        e.target.value === data.name,
                                    },
                                  },
                                });
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={() => (
                      <FormItem className="flex flex-col h-full">
                        <FormLabel className="text-xs">Editor</FormLabel>
                        <Editor
                          id={data.id}
                          type="description"
                          inputs={data.metadata.inputs ?? []}
                          placeholder="Describe your response"
                          rawDescription={data.metadata.rawDescription}
                          onChange={onChange}
                          onError={(error: Error) => {
                            console.error(error);
                          }}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </Form>
            </div>
          </ExpandableCardContent>
        </ExpandableCard>
        <DeleteAlertDialog
          open={deleteAlertDialogOpen}
          setOpen={setDeleteAlertDialogOpen}
          onDelete={() => {
            reactFlow.deleteElements({
              nodes: [
                {
                  id: data.id,
                },
              ],
            });
            deleteResponse.mutate({
              id: data.id,
            });
          }}
        />
        <Handle
          className="border rounded-full bg-background p-1"
          type="target"
          position={Position.Left}
        />
        <Handle
          className="border rounded-full bg-background p-1"
          type="source"
          position={Position.Right}
        />
      </>
    );
  },
);

Response.displayName = "Response";
