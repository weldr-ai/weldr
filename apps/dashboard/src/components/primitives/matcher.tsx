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
import { Input } from "@integramind/ui/input";
import { ScrollArea } from "@integramind/ui/scroll-area";
import { cn } from "@integramind/ui/utils";
import { createId } from "@paralleldrive/cuid2";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import {
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Link,
  PlayCircleIcon,
  PlusIcon,
  RegexIcon,
  TrashIcon,
} from "lucide-react";
import { memo, useState } from "react";

import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode, FlowNodeProps } from "~/types";

export const Matcher = memo(
  ({ data, selected, positionAbsoluteX, positionAbsoluteY }: FlowNodeProps) => {
    const reactFlow = useReactFlow<FlowNode, FlowEdge>();
    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);

    const deleteMatcher = api.primitives.delete.useMutation();

    const [conditions, setConditions] = useState<
      {
        id: string;
        condition: string | undefined;
      }[]
    >([]);

    const addCondition = () => {
      setConditions([
        ...conditions,
        {
          id: createId(),
          condition: undefined,
        },
      ]);
    };

    return (
      <>
        <ExpandableCard>
          <ExpandableCardTrigger>
            <ContextMenu>
              <ContextMenuTrigger>
                <Card
                  className={cn(
                    "drag-handle flex min-h-[78px] w-[256px] cursor-grab flex-col items-start gap-2 bg-background px-5 py-4 dark:bg-muted",
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
                    <span className="text-sm">
                      {data.name ?? "new_matcher"}
                    </span>
                  </div>
                  {conditions.length > 0 && (
                    <div className="w-full space-y-2">
                      {conditions.map((condition) => (
                        <MatcherCondition
                          key={condition.id}
                          id={condition.id}
                          condition={condition.condition}
                        />
                      ))}
                    </div>
                  )}
                </Card>
              </ContextMenuTrigger>
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
            </ContextMenu>
          </ExpandableCardTrigger>
          <ExpandableCardContent className="nowheel flex h-[400px] flex-col p-0">
            <ExpandableCardHeader className="flex flex-col items-start justify-start px-6 py-4">
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
              <span className="text-sm">{data.name}</span>
            </ExpandableCardHeader>
            {conditions.length > 0 ? (
              <ScrollArea className="mb-4">
                <div className="flex flex-col gap-2 px-6">
                  {conditions.map((condition) => (
                    <MatcherConditionForm
                      key={condition.id}
                      id={condition.id}
                      condition={condition.condition}
                    />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col gap-2 h-full items-center justify-center text-sm text-muted-foreground">
                <span>No conditions</span>
                <span>Click + to add a condition</span>
              </div>
            )}
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
  ({ id, condition }: { id: string; condition: string | undefined }) => {
    return (
      <div className="relative w-full">
        <div className="text-sm text-muted-foreground border rounded-sm px-2 py-1 text-ellipsis truncate">
          {condition ?? "Unimplemented condition Unimplemented condition"}
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

const MatcherConditionForm = memo(
  ({ id, condition }: { id: string; condition: string | undefined }) => {
    return (
      <div className="flex gap-2">
        <Input value={condition} placeholder="Enter your condition" />
        <Button
          variant="outline"
          size="icon"
          className="hover:text-destructive"
        >
          <TrashIcon className="size-3" />
        </Button>
      </div>
    );
  },
);
