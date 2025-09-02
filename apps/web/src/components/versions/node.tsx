"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { ExpandIcon, ExternalLinkIcon, InfoIcon } from "lucide-react";
import { memo } from "react";

import type { RouterOutputs } from "@weldr/api";
import { Button, buttonVariants } from "@weldr/ui/components/button";

import { parseConventionalCommit } from "@/lib/utils";

import "@xyflow/react/dist/base.css";

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
  const publishedVersion = data.publishedAt !== null;
  const previewUrl = `https://${data.id}.preview.weldr.app`;

  const { getEdges } = useReactFlow();
  const edges = getEdges();
  const hasIncomingEdges = edges.some((edge) => edge.target === data.id);
  const hasOutgoingEdges = edges.some((edge) => edge.source === data.id);

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
            {!publishedVersion && (
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
            {(publishedVersion || data.status === "failed") && (
              <span
                className={cn("rounded-full px-2 py-0.5 text-xs", {
                  "bg-warning text-warning-foreground":
                    data.status === "planning",
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
          </div>
        </div>
        {data.status === "coding" ? (
          <div className="flex flex-col gap-2">
            <span className="font-medium text-xs capitalize">
              {parsed.message}
            </span>
            <p className="line-clamp-3 text-muted-foreground text-xs">
              {data.description}
            </p>
          </div>
        ) : (
          <p className="text-xs">No available information yet.</p>
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
