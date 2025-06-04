"use client";

import type { RouterOutputs } from "@weldr/api";
import { Button } from "@weldr/ui/components/button";
import { cn } from "@weldr/ui/lib/utils";
import type { ColorMode, Edge, Node, NodeProps } from "@xyflow/react";
import {
  Background,
  Handle,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { hierarchy, tree } from "d3-hierarchy";
import {
  GitCommitIcon,
  LoaderIcon,
  MinusIcon,
  PlusIcon,
  Undo2Icon,
} from "lucide-react";
import { memo, useState } from "react";

import { useTRPC } from "@/lib/trpc/react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@weldr/ui/hooks/use-toast";

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
import "@weldr/ui/styles/flow-builder.css";
import { useTheme } from "next-themes";
import Image from "next/image";

type VersionNode = Node<RouterOutputs["versions"]["list"][number]>;

type VersionEdge = Edge & {
  source: string;
  target: string;
};

interface HierarchyNode {
  id: string;
  version: RouterOutputs["versions"]["list"][number];
  children?: HierarchyNode[];
}

const VersionNode = memo(({ data }: NodeProps<VersionNode>) => {
  const [imageError, setImageError] = useState(false);
  const activeVersion = data.activatedAt !== null;
  const previewUrl = data.thumbnail
    ? `https://${data.id}.preview.weldr.app`
    : null;

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

  return (
    <>
      {hasIncomingEdges && (
        <Handle type="target" position={Position.Top} className="opacity-0" />
      )}
      <div className="flex w-[350px] flex-col rounded-lg border bg-muted">
        <div className="flex h-7 items-center justify-between gap-2 rounded-t-lg border-b px-2 text-xs">
          <div className="flex items-center gap-2">
            <GitCommitIcon className="size-3.5 text-primary" />
            <span className="text-muted-foreground">{`#${data.number}`}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="max-w-[230px] truncate">{data.message}</span>
              </TooltipTrigger>
              <TooltipContent className="border bg-muted">
                <span className="mr-1 text-muted-foreground">
                  {`#${data.number}`}
                </span>
                {data.message}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-1">
            {!data.activatedAt && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 rounded-sm text-muted-foreground"
                  >
                    <Undo2Icon className="size-3" />
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
        <a
          href={previewUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="group relative"
        >
          {!imageError ? (
            <>
              <Image
                src={data.thumbnail ?? ""}
                alt={`Version ${data.number}`}
                width={350}
                height={200}
                className={cn(
                  "flex h-[200px] w-[350px] flex-col gap-2 rounded-b-lg bg-muted",
                  {
                    "border-primary": activeVersion,
                  },
                )}
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-background/30 opacity-0 transition-all duration-300 ease-in-out group-hover:opacity-100">
                <p className="font-medium text-sm text-white">Open Preview</p>
              </div>
            </>
          ) : (
            <div
              className={cn(
                "flex h-[200px] w-[348px] items-center justify-center rounded-b-lg bg-muted",
                {
                  "border-primary": activeVersion,
                },
              )}
            >
              <span className="absolute text-muted-foreground transition-opacity duration-300 ease-in-out group-hover:opacity-0">
                No thumbnail available
              </span>
              <span className="absolute text-muted-foreground opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100">
                Open Preview
              </span>
            </div>
          )}
        </a>
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

const nodeTypes = {
  version: VersionNode,
};

export function Versions({
  versions,
}: {
  versions: RouterOutputs["versions"]["list"];
}) {
  const { resolvedTheme } = useTheme();

  const rootVersions = versions.filter((v) => !v.parentVersionId);

  const buildHierarchy = (
    version: RouterOutputs["versions"]["list"][number],
  ): HierarchyNode => {
    const children = versions
      .filter((v) => v.parentVersionId === version.id)
      .map(buildHierarchy);

    return {
      id: version.id,
      version,
      children: children.length ? children : undefined,
    };
  };

  const rootNodes = rootVersions.map(buildHierarchy);

  const hierarchies = rootNodes.map((root) => hierarchy(root));

  const treeLayout = tree<HierarchyNode>().nodeSize([500, 300]);

  const layouts = hierarchies.map((h) => treeLayout(h));

  const initialNodes: VersionNode[] = [];
  const initialEdges: VersionEdge[] = [];

  for (const layout of layouts) {
    for (const node of layout.descendants()) {
      initialNodes.push({
        id: node.data.id,
        type: "version",
        position: { x: node.x, y: node.y },
        data: node.data.version,
      });

      if (node.parent) {
        const edge = {
          id: `${node.parent.data.id}-${node.data.id}`,
          source: node.parent.data.id,
          target: node.data.id,
          type: "smoothstep",
        };
        initialEdges.push(edge);
      }
    }
  }

  const viewPort = useViewport();
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <ReactFlow
      className="rounded-xl border"
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      panOnScroll={true}
      maxZoom={2}
      minZoom={0.1}
      fitView={true}
      fitViewOptions={{
        maxZoom: 1,
      }}
      nodesDraggable={false}
      nodesConnectable={false}
      defaultEdgeOptions={{
        type: "smoothstep",
      }}
      colorMode={resolvedTheme as ColorMode}
    >
      <Background
        color={
          resolvedTheme === "dark"
            ? "var(--color-background)"
            : "var(--color-muted)"
        }
        bgColor={
          resolvedTheme === "dark"
            ? "var(--color-background)"
            : "var(--color-muted)"
        }
      />

      <Panel position="bottom-right" className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 rounded-md border bg-background p-0.5 dark:bg-muted">
          <Button
            className="size-8 rounded-md"
            variant="ghost"
            size="icon"
            onClick={() => {
              zoomOut();
            }}
          >
            <MinusIcon className="size-4" />
          </Button>
          <Button
            className="h-8 rounded-md px-2 text-xs"
            variant="ghost"
            onClick={() => {
              fitView({
                maxZoom: 1,
              });
            }}
          >
            {`${Math.floor(viewPort.zoom * 100)}%`}
          </Button>
          <Button
            className="size-8 rounded-md"
            variant="ghost"
            size="icon"
            onClick={() => {
              zoomIn();
            }}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </Panel>
    </ReactFlow>
  );
}
