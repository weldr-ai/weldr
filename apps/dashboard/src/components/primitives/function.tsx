"use client";

import type { EditorState, LexicalEditor, ParagraphNode } from "lexical";
import type { z } from "zod";
import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { skipToken, useQuery } from "@tanstack/react-query";
import { $getRoot } from "lexical";
import {
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  LockIcon,
  PlayCircleIcon,
  TrashIcon,
  UnlockIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Handle, Position, useEdges, useNodes, useReactFlow } from "reactflow";

import { updateFunctionSchema } from "@integramind/db/schema";
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
import { FormField } from "@integramind/ui/form";
import { Input as InputComponent } from "@integramind/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@integramind/ui/resizable";
import { ScrollArea } from "@integramind/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@integramind/ui/tabs";
import { cn } from "@integramind/ui/utils";

import type { ReferenceNode } from "~/components/editor/nodes/reference-node";
import type {
  FunctionNodeProps,
  FunctionRawDescription,
  Input,
  PrimitiveData,
} from "~/types";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import Editor from "~/components/editor";
import { LambdaIcon } from "~/components/icons/lambda-icon";
import {
  deletePrimitive,
  getFunctionPrimitiveById,
  updateFunctionPrimitiveById,
} from "~/lib/queries/primitives";
import { getJobById } from "~/lib/queries/run";

async function runPrimitive({
  id,
}: {
  id: string;
}): Promise<{ id: string | null }> {
  const response = await fetch("/api/run", {
    method: "POST",
    body: JSON.stringify({
      id,
    }),
  });

  if (!response.ok || response.status !== 200) {
    return { id: null };
  }

  return response.json() as Promise<{ id: string }>;
}

export const Function = memo(
  ({ data, isConnectable, selected, xPos, yPos }: FunctionNodeProps) => {
    const reactFlow = useReactFlow();
    const nodes = useNodes<PrimitiveData>();
    const edges = useEdges<"deletable-edge">();
    const form = useForm<z.infer<typeof updateFunctionSchema>>({
      resolver: zodResolver(updateFunctionSchema),
      defaultValues: {
        name: data.name,
        description: data.description ?? undefined,
      },
    });

    const inputs = useMemo(() => {
      const parents = edges.reduce((acc, edge) => {
        if (edge.source === data.id) {
          const parent = nodes.find((node) => node.id === edge.target);
          if (parent) {
            acc.push(parent.data);
          }
        }
        return acc;
      }, [] as PrimitiveData[]);

      const inputs = parents.reduce((acc, parent) => {
        if (parent.type === "route" || parent.type === "workflow") {
          if (parent.inputs) {
            parent.inputs.forEach((input) => {
              acc.push({
                id: input.id,
                name: input.name,
                type: input.type,
                testValue: input.testValue,
              });
            });
          }
        }
        return acc;
      }, [] as Input[]);
      return inputs;
    }, [data.id, edges, nodes]);

    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);

    const [jobId, setJobId] = useState<string | null>(null);

    const { data: functionData, refetch } = useQuery({
      queryKey: [data.id],
      queryFn: () => getFunctionPrimitiveById({ id: data.id }),
      initialData: data,
    });

    const { data: job, refetch: refetchJob } = useQuery({
      queryKey: ["job", jobId],
      queryFn: jobId ? () => getJobById({ id: jobId }) : skipToken,
    });

    function onChange(editorState: EditorState) {
      editorState.read(() => {
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
        }, [] as FunctionRawDescription[]);
        const inputs: Input[] = [];
        let resource: { id: string; provider: string } | null = null;

        children.forEach((child) => {
          if (child.__type === "reference") {
            const referenceNode = child as ReferenceNode;
            if (
              referenceNode.__referenceType === "input" &&
              referenceNode.__dataType
            ) {
              inputs.push({
                id: referenceNode.__id,
                name: referenceNode.__name,
                type: referenceNode.__dataType,
                testValue: referenceNode.__testValue ?? null,
              });
            } else if (referenceNode.__referenceType === "database") {
              resource = {
                id: referenceNode.__id,
                provider: "postgres",
              };
            }
          }
        });

        void updateFunctionPrimitiveById({
          id: data.id,
          description,
          inputs,
          resource,
          rawDescription,
          isCodeUpdated:
            functionData?.description?.trim().toLowerCase() ===
            description.trim().toLowerCase(),
        });

        void refetch();
      });
    }

    function onError(error: Error, _editor: LexicalEditor) {
      console.error(error);
    }

    useEffect(() => {
      const interval = setInterval(() => {
        if (job && (job.state === "RUNNING" || job.state === "PENDING")) {
          void refetchJob();
        }
      }, 100);

      return () => {
        clearInterval(interval);
      };
    }, [job, refetchJob]);

    if (!functionData) {
      return null;
    }

    return (
      <>
        <Handle
          className="border-border bg-background p-1"
          type="source"
          position={Position.Left}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
        <ExpandableCard>
          <ExpandableCardTrigger>
            <ContextMenu>
              <ContextMenuTrigger>
                <Card
                  className={cn(
                    "drag-handle flex h-[84px] w-[256px] cursor-grab flex-col items-start gap-2 bg-muted px-5 py-4",
                    {
                      "border-primary": selected,
                    },
                  )}
                  onClick={() => {
                    reactFlow.fitBounds(
                      {
                        x: xPos,
                        y: yPos,
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
                    <LambdaIcon className="size-4 text-primary" />
                    <span className="text-muted-foreground">Function</span>
                  </div>
                  <span className="text-sm">{functionData?.name}</span>
                </Card>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuLabel className="text-xs">
                  Function
                </ContextMenuLabel>
                <ContextMenuSeparator />
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
          </ExpandableCardTrigger>
          <ExpandableCardContent className="nowheel flex h-[400px] flex-col p-0">
            <div className="flex size-full flex-col">
              <ExpandableCardHeader className="flex flex-col items-start justify-start px-4 py-4">
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <LambdaIcon className="size-4 text-primary" />
                    <span className="text-muted-foreground">Function</span>
                  </div>
                  <div className="flex items-center">
                    <Button
                      className="size-7 text-success hover:text-success"
                      variant="ghost"
                      size="icon"
                      disabled={
                        job?.state === "RUNNING" || job?.state === "PENDING"
                      }
                      onClick={async () => {
                        const job = await runPrimitive({ id: functionData.id });
                        console.log(job);
                        setJobId(job.id);
                      }}
                    >
                      <PlayCircleIcon className="size-3.5" />
                    </Button>
                    <Button
                      className="size-7 text-muted-foreground hover:text-muted-foreground"
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        await updateFunctionPrimitiveById({
                          id: functionData.id,
                          isLocked: !functionData.isLocked,
                        });
                        await refetch();
                      }}
                    >
                      {functionData.isLocked ? (
                        <LockIcon className="size-3.5" />
                      ) : (
                        <UnlockIcon className="size-3.5" />
                      )}
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
                          Function
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs">
                          <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
                          Run with previous primitives
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center justify-between text-xs">
                          <Link
                            className="flex items-center"
                            href="https://docs.integramind.ai/primitives/ai-processing"
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
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <InputComponent
                      {...field}
                      autoComplete="off"
                      value={functionData?.name}
                      className="h-8 border-none bg-muted p-0 text-sm focus-visible:ring-0"
                      onBlur={async (e) => {
                        await updateFunctionPrimitiveById({
                          id: data.id,
                          name: e.target.value,
                        });
                        await refetch();
                      }}
                    />
                  )}
                />
              </ExpandableCardHeader>
              <ResizablePanelGroup direction="vertical" className="flex h-full">
                <ResizablePanel
                  defaultSize={60}
                  minSize={25}
                  className="flex flex-col gap-2 px-4 pb-4"
                >
                  <span className="text-xs text-muted-foreground">Editor</span>
                  <Editor
                    id={functionData.id}
                    type="description"
                    inputs={inputs}
                    placeholder="Describe your function"
                    rawDescription={functionData.rawDescription}
                    onChange={onChange}
                    onError={onError}
                  />
                </ResizablePanel>
                <ResizableHandle className="border-b" withHandle />
                <ResizablePanel
                  defaultSize={0}
                  minSize={15}
                  className="flex size-full rounded-b-xl px-4 py-4"
                >
                  <Tabs
                    defaultValue="result"
                    className="flex w-full flex-col space-y-4"
                  >
                    <TabsList className="w-full justify-start bg-accent">
                      <TabsTrigger className="w-full" value="result">
                        Result
                      </TabsTrigger>
                      <TabsTrigger className="w-full" value="summary">
                        Summary
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent
                      value="result"
                      className="size-full rounded-lg bg-background"
                    >
                      <div className="flex size-full items-center justify-center px-6">
                        {job?.state === "PENDING" ||
                        job?.state === "RUNNING" ? (
                          <div className="flex size-full items-center justify-center">
                            <Loader2Icon className="size-6 animate-spin text-primary" />
                          </div>
                        ) : (
                          <>
                            {!job ? (
                              <div className="flex size-full items-center justify-center px-6">
                                <span className="text-muted-foreground">
                                  Click run to view output
                                </span>
                              </div>
                            ) : job.state === "FAILED" ? (
                              <div className="flex size-full items-center justify-center">
                                <span className="text-error">Failed</span>
                              </div>
                            ) : job.result ? (
                              <ScrollArea className="h-full p-2">
                                <pre className="text-wrap">
                                  {JSON.stringify(
                                    JSON.parse(job.result),
                                    null,
                                    2,
                                  )}
                                </pre>
                              </ScrollArea>
                            ) : (
                              <span>SUCCESS</span>
                            )}
                          </>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent
                      value="summary"
                      className="size-full rounded-lg bg-background"
                    >
                      <div className="flex size-full items-center justify-center px-6 text-muted-foreground">
                        General info
                      </div>
                    </TabsContent>
                  </Tabs>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ExpandableCardContent>
        </ExpandableCard>
        <DeleteAlertDialog
          open={deleteAlertDialogOpen}
          setOpen={setDeleteAlertDialogOpen}
          onDelete={async () => {
            reactFlow.deleteElements({
              nodes: [
                {
                  id: data.id,
                },
              ],
            });
            await deletePrimitive({
              id: data.id,
            });
          }}
        />
        <Handle
          className="border-border bg-background p-1"
          type="target"
          position={Position.Right}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
      </>
    );
  },
);

Function.displayName = "Function";
