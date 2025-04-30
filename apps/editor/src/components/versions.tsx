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
import Image from "next/image";
import { memo } from "react";

import { useTRPC } from "@/lib/trpc/react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "@weldr/ui/hooks/use-toast";

import "@xyflow/react/dist/base.css";

import "@weldr/ui/styles/flow-builder.css";
import { useTheme } from "next-themes";

type VersionNode = Node<RouterOutputs["projects"]["byId"]["versions"][number]>;

type VersionEdge = Edge & {
  source: string;
  target: string;
};

interface HierarchyNode {
  id: string;
  version: RouterOutputs["projects"]["byId"]["versions"][number];
  children?: HierarchyNode[];
}

const VersionNode = memo(({ data }: NodeProps<VersionNode>) => {
  const isCurrent = data.isCurrent;
  const previewUrl = data.machineId
    ? `https://${data.machineId}-${data.projectId}.preview.weldr.app`
    : null;

  const { getEdges, setNodes } = useReactFlow();
  const edges = getEdges();
  const hasIncomingEdges = edges.some((edge) => edge.target === data.id);
  const hasOutgoingEdges = edges.some((edge) => edge.source === data.id);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const setCurrentVersion = useMutation(
    trpc.versions.setCurrent.mutationOptions({
      onSuccess: (data) => {
        void queryClient.invalidateQueries(
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
        <Handle
          type="target"
          position={Position.Top}
          className="rounded-full border bg-background p-1"
        />
      )}
      <div
        className={cn(
          "flex h-[300px] w-[400px] flex-col gap-4 rounded-md border bg-muted",
          {
            "border-primary": isCurrent,
          },
        )}
      >
        <div className="flex justify-between px-3 pt-3">
          <div className="flex items-center gap-2">
            <GitCommitIcon className="size-4" />
            <div className="flex flex-col">
              <span className={cn("font-medium", isCurrent && "text-primary")}>
                Version {data.number}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="max-w-[300px] truncate text-muted-foreground text-sm">
                    {data.message}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="rounded-sm border bg-muted text-foreground text-xs">
                  <span>{data.message}</span>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          {!isCurrent && (
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <Undo2Icon className="size-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent className="rounded-sm border bg-muted text-foreground text-xs">
                  Restore Version
                </TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restore Version</AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogDescription>
                  Are you sure you want to restore this version? This will
                  replace the current version with the selected version.
                </AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setCurrentVersion.mutate({ versionId: data.id });
                    }}
                    disabled={setCurrentVersion.isPending}
                  >
                    {setCurrentVersion.isPending && (
                      <LoaderIcon className="mr-2 size-4 animate-spin" />
                    )}
                    Restore
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="flex size-full items-center justify-center px-2 pb-2">
          <div className="flex size-full items-center justify-center overflow-hidden rounded-md bg-background">
            {data.thumbnail && previewUrl ? (
              <a
                href={previewUrl}
                className="group relative flex size-full items-center justify-center"
                target="_blank"
                rel="noreferrer"
              >
                <Image
                  src={data.thumbnail}
                  alt={`Version ${data.number} preview`}
                  width={512}
                  height={512}
                  className="object-cover transition-transform duration-200 group-hover:scale-[1.05]"
                  priority
                />
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="font-medium">View Preview</span>
                </div>
              </a>
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="text-muted-foreground text-sm">
                  No preview available
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      {hasOutgoingEdges && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="rounded-full border bg-background p-1"
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
  versions: RouterOutputs["projects"]["byId"]["versions"];
}) {
  const { resolvedTheme } = useTheme();

  const rootVersions = versions.filter((v) => !v.parentVersionId);

  const buildHierarchy = (
    version: RouterOutputs["projects"]["byId"]["versions"][number],
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

  const treeLayout = tree<HierarchyNode>().nodeSize([500, 400]);

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
