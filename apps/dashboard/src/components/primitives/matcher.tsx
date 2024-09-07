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
import { ScrollArea } from "@integramind/ui/scroll-area";
import { cn } from "@integramind/ui/utils";
import { createId } from "@paralleldrive/cuid2";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import {
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PlayCircleIcon,
  PlusIcon,
  RegexIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { memo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import type { MatcherPrimitive } from "@integramind/shared/types";
import type { matcherPrimitiveMetadataSchema } from "@integramind/shared/validators/primitives";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@integramind/ui/form";
import { Input } from "@integramind/ui/input";
import { $getRoot, type EditorState } from "lexical";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode, FlowNodeProps } from "~/types";
import Editor from "../editor";

const validationSchema = z.object({
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
});

export const Matcher = memo(
  ({
    data: _data,
    selected,
    positionAbsoluteX,
    positionAbsoluteY,
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
    const data = fetchedData as MatcherPrimitive;

    const deleteMatcher = api.primitives.delete.useMutation();

    const updateMatcher = api.primitives.update.useMutation({
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
      },
    });

    const [conditions, setConditions] = useState<
      z.infer<typeof matcherPrimitiveMetadataSchema>["conditions"]
    >(data.metadata.conditions ?? []);

    const addCondition = () => {
      const newConditionId = createId();

      const newCondition = {
        id: newConditionId,
        description: null,
        rawDescription: [],
      };

      setConditions([...conditions, newCondition]);

      updateMatcher.mutate({
        where: {
          id: data.id,
          flowId: data.flowId,
        },
        payload: {
          type: "matcher",
          metadata: {
            conditions: [...conditions, newCondition],
          },
        },
      });
    };

    const deleteCondition = (id: string) => {
      setConditions(conditions.filter((condition) => condition.id !== id));

      updateMatcher.mutate({
        where: {
          id: data.id,
          flowId: data.flowId,
        },
        payload: {
          type: "matcher",
          metadata: {
            conditions: conditions.filter((condition) => condition.id !== id),
          },
        },
      });
    };

    return (
      <>
        <ExpandableCard>
          <ContextMenu>
            <ContextMenuTrigger>
              <ExpandableCardTrigger>
                <Card
                  className={cn(
                    "drag-handle flex min-h-[84px] w-[256px] cursor-grab flex-col items-start justify-center gap-2 bg-background px-5 py-4 dark:bg-muted",
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
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <RegexIcon className="size-4 text-primary" />
                      <span className="text-muted-foreground">Matcher</span>
                    </div>
                    <span className="text-start text-sm">
                      {data.name ?? "new_matcher"}
                    </span>
                  </div>
                  {conditions.length > 0 && (
                    <div className="w-full space-y-2">
                      {conditions.map((condition) => (
                        <MatcherCondition
                          key={condition.id}
                          id={condition.id}
                          description={condition.description}
                        />
                      ))}
                    </div>
                  )}
                </Card>
              </ExpandableCardTrigger>
              <ContextMenuContent>
                <ContextMenuLabel className="text-xs">Matcher</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem className="text-xs">
                  <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
                  Run with previous primitives
                </ContextMenuItem>
                <ContextMenuItem className="flex items-center justify-between text-xs">
                  <Link
                    className="flex items-center"
                    href="https://docs.integramind.ai/primitives/matcher"
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
            </ContextMenuTrigger>
          </ContextMenu>
          <ExpandableCardContent className="nowheel flex h-[400px] flex-col p-0">
            <ExpandableCardHeader className="flex flex-col items-start justify-start px-6 pt-4">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <RegexIcon className="size-4 text-primary" />
                  <span className="text-muted-foreground">Matcher</span>
                </div>
                <div className="flex items-center ">
                  <Button
                    className="size-7 text-success hover:text-success"
                    variant="ghost"
                    size="icon"
                  >
                    <PlayCircleIcon className="size-3.5" />
                  </Button>
                  <Button
                    className="size-7 text-muted-foreground hover:text-muted-foreground"
                    variant="ghost"
                    size="icon"
                    onClick={addCondition}
                  >
                    <PlusIcon className="size-3.5" />
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
            <div className="flex flex-col h-full gap-6">
              <Form {...form}>
                <div className="px-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete="off"
                            className="h-8 border-none shadow-none p-0 dark:bg-muted text-base focus-visible:ring-0"
                            placeholder="matcher_name"
                            onBlur={(e) => {
                              const isValid =
                                validationSchema.shape.name.safeParse(
                                  e.target.value,
                                ).success;
                              if (isValid) {
                                updateMatcher.mutate({
                                  where: {
                                    id: data.id,
                                    flowId: data.flowId,
                                  },
                                  payload: {
                                    type: "matcher",
                                    name: e.target.value,
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
                </div>
                {conditions.length > 0 ? (
                  <ScrollArea className="mb-4">
                    <div className="flex flex-col gap-2 px-6">
                      {conditions.map((condition) => (
                        <div key={condition.id} className="relative flex gap-2">
                          <Editor
                            id={condition.id}
                            className="h-32"
                            placeholder="Write a description for this condition"
                            type="description"
                            rawDescription={condition.rawDescription}
                            onChange={(editorState: EditorState) => {
                              editorState.read(async () => {
                                const root = $getRoot();
                                const description = root.getTextContent();
                                await updateMatcher.mutateAsync({
                                  where: {
                                    id: data.id,
                                    flowId: data.flowId,
                                  },
                                  payload: {
                                    type: "matcher",
                                    metadata: {
                                      conditions: [
                                        ...conditions.filter(
                                          (c) => c.id !== condition.id,
                                        ),
                                        {
                                          ...condition,
                                          description,
                                        },
                                      ],
                                    },
                                  },
                                });
                              });
                            }}
                            onError={(error: Error) => {
                              console.error(error);
                            }}
                            inputs={[]}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:text-destructive absolute right-1 top-1 size-6"
                            onClick={() => deleteCondition(condition.id)}
                          >
                            <TrashIcon className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col gap-2 h-full items-center justify-center text-sm text-muted-foreground">
                    <span>No conditions</span>
                    <span>Click + to add a condition</span>
                  </div>
                )}
              </Form>
            </div>
          </ExpandableCardContent>
        </ExpandableCard>
        <Handle
          type="target"
          position={Position.Left}
          className="border rounded-full bg-background p-1"
        />
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
            deleteMatcher.mutate({
              id: data.id,
            });
          }}
        />
      </>
    );
  },
);

Matcher.displayName = "Matcher";

const MatcherCondition = memo(
  ({
    id,
    description,
  }: {
    id: string;
    description: string | null;
  }) => {
    return (
      <div className="relative w-full">
        <div className="text-sm text-muted-foreground border rounded-sm px-2 py-1 text-ellipsis truncate text-start">
          {description ?? "Unimplemented condition Unimplemented condition"}
        </div>
        <Handle
          id={id}
          type="source"
          position={Position.Right}
          className="border rounded-full bg-background p-1"
        />
      </div>
    );
  },
);
