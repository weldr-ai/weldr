import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  FileText,
  Loader2,
  PlayCircle,
  Trash,
  X,
} from "lucide-react";
import { Handle, Position, useReactFlow } from "reactflow";

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
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@integramind/ui/resizable";
import { ScrollArea } from "@integramind/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@integramind/ui/sheet";
import { cn } from "@integramind/ui/utils";

import type { FunctionPrimitiveProps } from "~/types";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { Lambda } from "~/components/icons/lambda";
import { getJobById } from "~/lib/queries/run";
import { useDevelopmentSheetStore } from "~/lib/store";

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
  ({ data, isConnectable, selected }: FunctionPrimitiveProps) => {
    const reactFlow = useReactFlow();
    const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
      useState<boolean>(false);
    const currentId = useDevelopmentSheetStore((state) => state.currentId);
    const updateCurrentId = useDevelopmentSheetStore(
      (state) => state.updateCurrentId,
    );
    const removeCurrentId = useDevelopmentSheetStore(
      (state) => state.removeCurrentId,
    );
    const [jobId, setJobId] = useState<string | undefined>();

    const postJobMutation = useMutation({
      mutationFn: postJob,
      onSuccess: (data) => {
        setJobId(data.id);
      },
    });

    const { data: job, refetch: refetchJob } = useQuery({
      queryKey: ["job", jobId],
      queryFn: jobId ? () => getJobById({ id: jobId }) : skipToken,
    });

    useEffect(() => {
      const interval = setInterval(() => {
        if (job && (job.state === "RUNNING" || job.state === "PENDING")) {
          void refetchJob();
        }
      }, 100);
      return () => clearInterval(interval);
    }, [job, refetchJob]);

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
              onClick={() => updateCurrentId(data.id)}
              className={cn(
                "flex h-[78px] w-[256px] cursor-grab flex-col items-start gap-2 px-5 py-4",
                {
                  "border-primary": selected,
                },
              )}
            >
              <div className="flex items-center gap-2 text-xs">
                <Lambda className="size-4 text-primary" />
                <span className="text-muted-foreground">Function</span>
              </div>
              <span className="text-sm">{data.name}</span>
            </Card>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel className="text-xs">Function</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-xs">
              <PlayCircle className="mr-3 size-4 text-muted-foreground" />
              Run with previous primitives
            </ContextMenuItem>
            <ContextMenuItem className="flex items-center justify-between text-xs">
              <Link
                className="flex items-center"
                href="https://docs.integramind.ai/primitives/ai-processing"
                target="blank"
              >
                <FileText className="mr-3 size-4 text-muted-foreground" />
                Docs
              </Link>
              <ExternalLink className="size-3 text-muted-foreground" />
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="flex text-xs text-destructive hover:text-destructive focus:text-destructive/90"
              onClick={() => setDeleteAlertDialogOpen(true)}
            >
              <Trash className="mr-3 size-4" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <Sheet modal={false} open={currentId === data.id}>
          <SheetContent className="right-2 top-16 flex h-[calc(100dvh-72px)] w-full flex-col gap-4 rounded-xl border bg-muted p-0">
            <SheetHeader className="p-6">
              <SheetTitle className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lambda className="size-4" />
                  <span>Function</span>
                </div>
                <div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-success hover:text-success"
                    disabled={
                      postJobMutation.isPending ||
                      job?.state === "RUNNING" ||
                      job?.state === "PENDING"
                    }
                    onClick={() => postJobMutation.mutate()}
                  >
                    <PlayCircle className="size-4" />
                  </Button>
                  <SheetClose onClick={() => removeCurrentId()}>
                    <Button variant="ghost" size="icon">
                      <X className="size-4" />
                      <span className="sr-only">Close</span>
                    </Button>
                  </SheetClose>
                </div>
              </SheetTitle>
              <SheetDescription className="flex flex-col gap-0.5">
                Develop your function here
              </SheetDescription>
            </SheetHeader>
            <ResizablePanelGroup
              direction="vertical"
              className="h-[calc(100dvh-72px)]"
            >
              <ResizablePanel defaultSize={75} minSize={25}>
                <div className="flex h-full items-center justify-center">
                  <span className="font-semibold">Header</span>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={25} minSize={25}>
                <div className="flex size-full rounded-b-xl bg-background">
                  {job?.state === "PENDING" || job?.state === "RUNNING" ? (
                    <div className="flex size-full items-center justify-center">
                      <Loader2 className="size-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      {!job ? (
                        <div className="flex size-full items-center justify-center">
                          <span className="text-muted-foreground">
                            Click run to return output
                          </span>
                        </div>
                      ) : job.state === "FAILED" ? (
                        <div className="flex size-full items-center justify-center">
                          <span className="text-error">Failed</span>
                        </div>
                      ) : job.result ? (
                        <ScrollArea className="h-full">
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
          </SheetContent>
        </Sheet>
        <DeleteAlertDialog
          open={deleteAlertDialogOpen}
          setOpen={setDeleteAlertDialogOpen}
          onDelete={() =>
            reactFlow.deleteElements({
              nodes: [
                {
                  id: data.id,
                },
              ],
            })
          }
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
