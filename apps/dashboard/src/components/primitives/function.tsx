import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import {
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  PlayCircleIcon,
  TrashIcon,
} from "lucide-react";
import { Handle, Position, useReactFlow } from "reactflow";

import { Button } from "@integramind/ui/button";
import { Card, CardContent, CardHeader } from "@integramind/ui/card";
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
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@integramind/ui/resizable";
import { ScrollArea } from "@integramind/ui/scroll-area";
import { cn } from "@integramind/ui/utils";

import type { FunctionNodeProps } from "~/types";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import Editor from "~/components/editor";
import { LambdaIcon } from "~/components/icons/lambda-icon";
import { getDataResources } from "~/lib/queries/data-resources";
import { deletePrimitive } from "~/lib/queries/primitives";
import { getJobById } from "~/lib/queries/run";
import { ReferenceOption } from "../editor/plugins/reference-plugin";

async function postJob(): Promise<{ id: string }> {
  const response = await fetch("/api/run", {
    method: "POST",
    body: JSON.stringify({
      name: "Get user",
      inputs: [{ name: "id", value: "1" }],
      functionCode: `
def get_user(id):
  import requests
  url = f"https://jsonplaceholder.typicode.com/posts/{id}"
  response = requests.get(url)
  data = response.json()
  return data
`,
    }),
  });

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  return response.json() as Promise<{ id: string }>;
}

export const Function = memo(
  ({ data, isConnectable, xPos, yPos }: FunctionNodeProps) => {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const reactFlow = useReactFlow();
    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [jobId, setJobId] = useState<string | undefined>();

    const deletePrimitiveMutation = useMutation({
      mutationFn: deletePrimitive,
    });
    const postJobMutation = useMutation({
      mutationFn: postJob,
      onSuccess: (data) => {
        setJobId(data.id);
      },
    });
    const {
      isLoading,
      isRefetching,
      data: dataResources,
    } = useQuery({
      queryKey: ["data-resources"],
      queryFn: () => getDataResources({ workspaceId }),
    });

    const { data: job, refetch: refetchJob } = useQuery({
      queryKey: ["job", jobId],
      queryFn: jobId ? () => getJobById({ id: jobId }) : skipToken,
    });

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (!popoverRef.current?.contains(event.target as Node)) {
          setIsExpanded(false);
        }
      };
      document.addEventListener("click", handleClickOutside);

      const interval = setInterval(() => {
        if (job && (job.state === "RUNNING" || job.state === "PENDING")) {
          void refetchJob();
        }
      }, 100);

      return () => {
        clearInterval(interval);
        document.removeEventListener("click", handleClickOutside);
      };
    }, [job, refetchJob, setIsExpanded, isExpanded]);

    return (
      <>
        <Handle
          className="border-border bg-background p-1"
          type="source"
          position={Position.Left}
          onConnect={(params) => console.log("handle onConnect", params)}
          isConnectable={isConnectable}
        />
        <ContextMenu>
          <ContextMenuTrigger>
            <Card
              className="drag-handle flex h-[84px] w-[256px] cursor-grab flex-col items-start gap-2 bg-muted px-5 py-4"
              onClick={() => {
                setIsExpanded(true);
                reactFlow.fitBounds(
                  {
                    x: xPos,
                    y: yPos,
                    width: 256,
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
              <span className="text-sm">{data.name}</span>
            </Card>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel className="text-xs">Function</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-xs">
              <PlayCircleIcon className="mr-3 size-4 text-muted-foreground" />
              Run with previous primitives
            </ContextMenuItem>
            <ContextMenuItem className="flex items-center justify-between text-xs">
              <Link
                className="flex items-center"
                href="https://docs.integramind.ai/primitives/ai-processing"
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
        <Card
          ref={popoverRef}
          className={cn(
            "absolute -left-[128px] top-0 z-10 w-[600px] cursor-default",
            {
              hidden: !isExpanded,
            },
          )}
        >
          <CardHeader className="flex flex-col items-start justify-start px-6 py-4">
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
                    postJobMutation.isPending ||
                    job?.state === "RUNNING" ||
                    job?.state === "PENDING"
                  }
                  onClick={() => postJobMutation.mutate()}
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
            <span className="text-sm">{data.name}</span>
          </CardHeader>
          <CardContent className="flex h-[400px] p-0">
            <ResizablePanelGroup direction="vertical" className="flex h-full">
              <ResizablePanel
                defaultSize={60}
                minSize={25}
                className="flex flex-col gap-0.5 p-2"
              >
                <span className="text-xs text-muted-foreground">Editor</span>
                {isLoading || isRefetching ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2Icon className="size-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <Editor
                    referenceOptions={
                      dataResources?.map(
                        (dataResource) =>
                          new ReferenceOption(
                            dataResource.id,
                            dataResource.name,
                            "data-resource",
                            {
                              icon: "postgres-icon",
                              keywords: [
                                "postgres",
                                "data-resource",
                                dataResource.name,
                              ],
                              onSelect: (queryString) => {
                                console.log(queryString);
                              },
                            },
                          ),
                      ) ?? []
                    }
                  />
                )}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={40} minSize={25}>
                <div className="flex size-full rounded-b-xl bg-accent">
                  {job?.state === "PENDING" || job?.state === "RUNNING" ? (
                    <div className="flex size-full items-center justify-center">
                      <Loader2Icon className="size-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      {!job ? (
                        <div className="flex size-full items-center justify-center">
                          <span className="text-muted-foreground">
                            Click run to view output
                          </span>
                        </div>
                      ) : job.state === "FAILED" ? (
                        <div className="flex size-full items-center justify-center">
                          <span className="text-error">Failed</span>
                        </div>
                      ) : job.result ? (
                        <ScrollArea className="nowheel h-full p-2">
                          <pre className="text-wrap">
                            {JSON.stringify(JSON.parse(job.result), null, 2)}
                          </pre>
                        </ScrollArea>
                      ) : (
                        <span>SUCCESS</span>
                      )}
                    </>
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </CardContent>
        </Card>
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
            await deletePrimitiveMutation.mutateAsync({
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
