"use client";

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

import { useUIStore } from "@/lib/store";
import type { RouterOutputs } from "@weldr/api";
import "@weldr/ui/styles/canvas.css";
import { Chat } from "../chat";
import { Placeholder } from "./placeholder";

const nodeTypes = {
  "declaration-v1": DeclarationV1Node,
};

export function Canvas({
  initialNodes,
  initialEdges,
  project,
  integrationTemplates,
  environmentVariables,
}: {
  initialNodes: CanvasNode[];
  initialEdges: Edge[];
  project: RouterOutputs["projects"]["byId"];
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
}) {
  const { showCanvasEdges, toggleCanvasEdges } = useUIStore();
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
      className="scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-transparent bg-background dark:bg-muted"
      nodes={nodes}
      onNodesChange={onNodesChange}
      edges={showCanvasEdges ? edges : []}
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
      {nodes.length === 0 && <Placeholder />}
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

      <Panel position="top-right">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="bg-background dark:bg-background"
              variant="outline"
              size="icon"
              disabled={!nodes.length}
              onClick={toggleCanvasEdges}
            >
              {showCanvasEdges ? (
                <EyeIcon className="size-3.5" />
              ) : (
                <EyeOffIcon className="size-3.5" />
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
      </Panel>

      <Panel position="bottom-center" className="max-h-[400px] w-[500px]">
        <Chat
          project={project}
          integrationTemplates={integrationTemplates}
          version={project.activeVersion}
          environmentVariables={environmentVariables}
        />
      </Panel>

      <Panel
        position="bottom-right"
        className="flex items-center rounded-lg border bg-background"
      >
        <Button
          className="size-9 rounded-r-none rounded-l-lg"
          variant="ghost"
          size="icon"
          disabled={!nodes.length}
          onClick={() => {
            zoomOut();
          }}
        >
          <MinusIcon className="size-3.5" />
        </Button>
        <Button
          className="h-9 rounded-none px-2 text-xs"
          variant="ghost"
          disabled={!nodes.length}
          onClick={() => {
            fitView({
              maxZoom: 1,
            });
          }}
        >
          {`${Math.floor(viewPort.zoom * 100)}%`}
        </Button>
        <Button
          className="size-9 rounded-r-lg rounded-l-none"
          variant="ghost"
          disabled={!nodes.length}
          size="icon"
          onClick={() => {
            zoomIn();
          }}
        >
          <PlusIcon className="size-3.5" />
        </Button>
      </Panel>
    </ReactFlow>
  );
}
