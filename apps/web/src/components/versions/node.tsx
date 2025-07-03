"use client";

import { useTRPC } from "@/lib/trpc/react";
import { parseConventionalCommit } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RouterOutputs } from "@weldr/api";
import { Button, buttonVariants } from "@weldr/ui/components/button";
import { toast } from "@weldr/ui/hooks/use-toast";
import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import {
  ExpandIcon,
  ExternalLinkIcon,
  InfoIcon,
  LoaderIcon,
  Undo2Icon,
} from "lucide-react";
import { memo } from "react";

import "@xyflow/react/dist/base.css";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@weldr/ui/components/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@weldr/ui/components/tooltip";
import { cn } from "@weldr/ui/lib/utils";
import "@weldr/ui/styles/canvas.css";
import Link from "next/link";
import { CommitTypeBadge } from "../commit-type-badge";

export type TVersionNode = Node<RouterOutputs["versions"]["list"][number]>;

export const VersionNode = memo(({ data }: NodeProps<TVersionNode>) => {
  const activeVersion = data.activatedAt !== null;
  const previewUrl = `https://${data.id}.preview.weldr.app`;

  const { getEdges, setNodes } = useReactFlow();
  const edges = getEdges();
  const hasIncomingEdges = edges.some((edge) => edge.target === data.id);
  const hasOutgoingEdges = edges.some((edge) => edge.source === data.id);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const setCurrentVersion = useMutation(
    trpc.versions.setCurrent.mutationOptions({
      onSuccess: async (data) => {
        await queryClient.invalidateQueries(
          trpc.projects.byId.queryFilter({
            id: data.newCurrentVersion.projectId,
          }),
        );
        setNodes((nodes) =>
          nodes.map((node) =>
            node.id === data.newCurrentVersion.id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    ...data.newCurrentVersion,
                  },
                }
              : node.id === data.previousCurrentVersion.id
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      ...data.previousCurrentVersion,
                    },
                  }
                : node,
          ),
        );
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Error setting current version",
          description: error.message,
        });
      },
    }),
  );

  const parsed = parseConventionalCommit(data.message);

  const isCompleted = data.status === "completed" || data.status === "failed";

  return (
    <>
      {hasIncomingEdges && (
        <Handle type="target" position={Position.Top} className="opacity-0" />
      )}
      <div className="flex w-[400px] flex-col gap-2 rounded-lg border bg-background p-3 dark:bg-muted">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="font-medium text-muted-foreground">{`#${data.number}`}</span>
            {parsed.type ? (
              <CommitTypeBadge type={parsed.type} />
            ) : (
              <span className="inline-flex items-center rounded-md bg-accent px-2 py-1 font-medium text-accent-foreground text-xs">
                Version
              </span>
            )}
            {isCompleted && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-6">
                    <InfoIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px] border bg-muted">
                  {data.description}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!activeVersion && (
              <Link
                href={`/projects/${data.projectId}?versionId=${data.id}`}
                className={cn(
                  buttonVariants({
                    variant: "ghost",
                    size: "icon",
                  }),
                  "size-6 rounded-sm text-muted-foreground hover:text-foreground",
                )}
              >
                <ExpandIcon className="size-3.5" />
              </Link>
            )}
            {(activeVersion || data.status === "failed") && (
              <span
                className={cn("rounded-full px-2 py-0.5 text-xs", {
                  "bg-warning text-warning-foreground":
                    data.status === "pending",
                  "bg-purple-500 text-purple-50": data.status === "planning",
                  "bg-teal-500 text-teal-50": data.status === "coding",
                  "bg-primary text-primary-foreground":
                    data.status === "deploying",
                  "bg-success text-success-foreground":
                    data.status === "completed",
                  "bg-destructive text-destructive-foreground":
                    data.status === "failed",
                })}
              >
                {data.status === "completed" && "Current"}
                {data.status === "pending" && "Pending"}
                {data.status === "planning" && "Planning"}
                {data.status === "coding" && "Coding"}
                {data.status === "deploying" && "Deploying"}
                {data.status === "failed" && "Failed"}
              </span>
            )}
            {isCompleted && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-sm text-muted-foreground hover:text-foreground"
                    onClick={() => window.open(previewUrl, "_blank")}
                  >
                    <ExternalLinkIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="border bg-muted">
                  <p>Open Preview</p>
                </TooltipContent>
              </Tooltip>
            )}
            {!data.activatedAt && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-sm text-muted-foreground hover:text-foreground"
                  >
                    <Undo2Icon className="size-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Set as current version</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to set this version as the current
                      version?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setCurrentVersion.mutate({
                          versionId: data.id,
                        });
                      }}
                    >
                      {setCurrentVersion.isPending && (
                        <LoaderIcon className="size-4 animate-spin" />
                      )}
                      Revert
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        {isCompleted ? (
          <div className="flex flex-col gap-2">
            <span className="font-medium text-xs capitalize">
              {parsed.message}
            </span>
            <p className="line-clamp-3 text-muted-foreground text-xs">
              {data.description}
            </p>
          </div>
        ) : (
          <p className="text-xs">
            No available information yet, please{" "}
            {data.status === "pending"
              ? "continue the process"
              : "wait until the version is completed"}
            .
          </p>
        )}
      </div>
      {hasOutgoingEdges && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="opacity-0"
        />
      )}
    </>
  );
});
