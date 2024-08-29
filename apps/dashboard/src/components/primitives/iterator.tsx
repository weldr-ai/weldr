import {
  Handle,
  NodeResizeControl,
  Position,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import { memo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import type { IteratorPrimitive } from "@integramind/shared/types";
import { updateIteratorSchema } from "@integramind/shared/validators/primitives";
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
  ExpandableCardHeader,
  ExpandableCardTrigger,
} from "@integramind/ui/expandable-card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
import { cn } from "@integramind/ui/utils";
import {
  ChevronRightIcon,
  CircleMinus,
  ExternalLinkIcon,
  FileTextIcon,
  PlayCircleIcon,
  RepeatIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { debounce } from "perfect-debounce";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode, FlowNodeProps } from "~/types";

export const Iterator = memo(
  ({
    data: _data,
    isConnectable,
    positionAbsoluteX,
    positionAbsoluteY,
    selected,
    parentId,
  }: FlowNodeProps) => {
    const { fitBounds, setNodes, deleteElements } = useReactFlow<
      FlowNode,
      FlowEdge
    >();
    if (_data.type !== "iterator") {
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
    const data = fetchedData as IteratorPrimitive;

    const updateIterator = api.primitives.update.useMutation({
      onSuccess: async () => {
        await refetch();
      },
    });
    const deleteIterator = api.primitives.delete.useMutation();

    const debouncedUpdateIterator = debounce(
      async (
        key: keyof z.infer<typeof updateIteratorSchema>,
        value: string,
      ) => {
        console.log("hello kitty");
        await updateIterator.mutateAsync({
          where: {
            id: data.id,
            flowId: data.flowId,
          },
          payload: {
            type: "iterator",
            [key]: value,
          },
        });
      },
      500,
      { trailing: false },
    );

    const form = useForm<z.infer<typeof updateIteratorSchema>>({
      resolver: zodResolver(updateIteratorSchema),
      defaultValues: {
        name: data.name ?? undefined,
        description: data.description ?? undefined,
        metadata: {
          iteratorType: data.metadata?.iteratorType,
        },
      },
    });

    const nodes = useNodes<FlowNode>();
    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);

    return (
      <>
        <div className="size-full relative">
          <ExpandableCard className="absolute top-[-42px] left-[50px]">
            <ContextMenu>
              <ContextMenuTrigger>
                <ExpandableCardTrigger>
                  <Card
                    className={cn(
                      "drag-handle flex h-[84px] w-[256px] cursor-grab flex-col items-start gap-2 px-5 py-4 dark:bg-muted",
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
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <RepeatIcon className="size-4 text-primary" />
                        <span className="text-muted-foreground">Iterator</span>
                      </div>
                    </div>
                    <span className="text-sm">
                      {data.name ?? "new_iterator"}
                    </span>
                  </Card>
                </ExpandableCardTrigger>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuLabel className="text-xs">
                  Iterator
                </ContextMenuLabel>
                <ContextMenuSeparator />
                {parentId && (
                  <ContextMenuItem
                    className="text-xs"
                    onClick={() => {
                      const parent = nodes.find((node) => node.id === parentId);
                      if (parent) {
                        setNodes(
                          nodes.map((node) => {
                            if (node.id === data.id) {
                              return {
                                ...node,
                                parentId: undefined,
                                extent: undefined,
                                expandParent: undefined,
                                position: {
                                  x:
                                    parent.position.x +
                                    (parent.measured?.width ?? 0) / 2 -
                                    150,
                                  y: parent.position.y - 100,
                                },
                              };
                            }
                            return node;
                          }),
                        );
                      }
                    }}
                  >
                    <CircleMinus className="mr-3 size-4 text-muted-foreground" />
                    Detach
                  </ContextMenuItem>
                )}
                <ContextMenuItem className="text-xs">
                  <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
                  Run with previous primitives
                </ContextMenuItem>
                <ContextMenuItem className="flex items-center justify-between text-xs">
                  <Link
                    className="flex items-center"
                    href="https://docs.integramind.ai/primitives/function"
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
            <ExpandableCardContent className="nowheel flex flex-col p-0 w-[400px]">
              <div className="flex size-full flex-col">
                <ExpandableCardHeader className="flex flex-col items-start justify-start">
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <RepeatIcon className="size-4 text-primary" />
                      <span className="text-muted-foreground">Iterator</span>
                    </div>
                  </div>
                </ExpandableCardHeader>
                <Form {...form}>
                  <div className="flex flex-col gap-6 px-4 pb-4">
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
                              placeholder="IteratorName"
                              onChange={async (e) => {
                                field.onChange(e.target.value);
                                debouncedUpdateIterator("name", e.target.value);
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="metadata.iteratorType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Iterator Type</FormLabel>
                          <FormControl>
                            <Select
                              {...field}
                              name={field.name}
                              onValueChange={async (value) => {
                                field.onChange(value);
                                await updateIterator.mutateAsync({
                                  where: {
                                    id: data.id,
                                    flowId: data.flowId,
                                  },
                                  payload: {
                                    type: "iterator",
                                    metadata: {
                                      iteratorType:
                                        value as IteratorPrimitive["metadata"]["iteratorType"],
                                    },
                                  },
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select iterator type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="for-each">
                                  For Each
                                </SelectItem>
                                <SelectItem value="map">Map</SelectItem>
                                <SelectItem value="reduce">Reduce</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              onChange={async (e) => {
                                field.onChange(e.target.value);
                                debouncedUpdateIterator(
                                  "description",
                                  e.target.value,
                                );
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </Form>
              </div>
            </ExpandableCardContent>
          </ExpandableCard>
          <div className="absolute p-1 top-[-12px] left-[306px] bg-background">
            <ChevronRightIcon className="text-primary size-4" />
          </div>
          <div className="z-[-9999] size-full min-w-[600px] min-h-[400px] border rounded-xl" />
        </div>
        <NodeResizeControl
          className="bg-primary border-none p-[2px] rounded-full"
          position="bottom-right"
          minWidth={600}
          minHeight={400}
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
            deleteIterator.mutate({
              id: data.id,
            });
          }}
        />
      </>
    );
  },
);

Iterator.displayName = "Iterator";
