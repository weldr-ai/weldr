"use client";

import { useCanvas } from "@/lib/store";
import { useTRPC } from "@/lib/trpc/react";
import type { CanvasNode } from "@/types";
import { Button } from "@weldr/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@weldr/ui/components/tooltip";
import { toast } from "@weldr/ui/hooks/use-toast";
import type { ColorMode, Edge } from "@xyflow/react";
import {
  Background,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { EyeIcon, EyeOffIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useCallback } from "react";
import { DeclarationV1Node } from "./nodes/declaration/v1";

import { useMutation } from "@tanstack/react-query";

import "@xyflow/react/dist/base.css";
import { useTheme } from "next-themes";

import "@weldr/ui/styles/flow-builder.css";

const nodeTypes = {
  "declaration-v1": DeclarationV1Node,
};

export function Canvas({
  initialNodes,
  initialEdges,
}: {
  initialNodes: CanvasNode[];
  initialEdges: Edge[];
}) {
  const { showEdges, toggleEdges } = useCanvas();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const viewPort = useViewport();
  const { resolvedTheme } = useTheme();
  const [nodes, _setNodes, onNodesChange] =
    useNodesState<CanvasNode>(initialNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  const trpc = useTRPC();

  const updateNode = useMutation(
    trpc.canvasNodes.update.mutationOptions({
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    }),
  );

  const onNodeDragStop = useCallback(
    async (
      _event: React.MouseEvent,
      node: CanvasNode,
      _nodes: CanvasNode[],
    ) => {
      const updatedData = {
        where: {
          id: node.id,
        },
        payload: {
          position: {
            x: Math.floor(node.position.x),
            y: Math.floor(node.position.y),
          },
        },
      };

      await updateNode.mutateAsync(updatedData);
    },
    [updateNode],
  );

  return (
    <ReactFlow
      className="scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-transparent rounded-xl border bg-background dark:bg-muted"
      nodes={nodes}
      onNodesChange={onNodesChange}
      edges={showEdges ? edges : []}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
      deleteKeyCode={null}
      nodeTypes={nodeTypes}
      panOnScroll={true}
      maxZoom={2}
      minZoom={0.1}
      fitView={true}
      fitViewOptions={{
        maxZoom: 1,
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="size-8 rounded-md bg-background dark:bg-background"
              variant="outline"
              size="icon"
              onClick={toggleEdges}
            >
              {showEdges ? (
                <EyeIcon className="size-4" />
              ) : (
                <EyeOffIcon className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="rounded-sm border bg-muted text-foreground"
          >
            <p>Show Dependencies</p>
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
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
