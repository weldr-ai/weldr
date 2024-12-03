"use client";

import { createId } from "@paralleldrive/cuid2";
import type { ColorMode, Node as ReactFlowNode } from "@xyflow/react";
import {
  Background,
  MiniMap,
  Panel,
  ReactFlow,
  useNodesState,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { BoxIcon, MinusIcon, PlusIcon } from "lucide-react";
import type React from "react";
import { useCallback } from "react";

import type { FlowNode, FlowNodeData } from "~/types";

import "@xyflow/react/dist/base.css";
import "~/styles/flow-builder.css";

import { Button } from "@integramind/ui/button";

import type { Flow } from "@integramind/shared/types";
import { useTheme } from "@integramind/ui/theme-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import { toast } from "@integramind/ui/use-toast";
import { FlowSheet } from "~/components/flow-sheet";
import { api } from "~/lib/trpc/client";
import { PrimitiveNode } from "./primitives";

const nodeTypes = {
  primitive: PrimitiveNode,
};

export function FlowBuilder({
  flow,
  initialNodes,
}: {
  flow: Flow;
  initialNodes: FlowNode[];
}) {
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const viewPort = useViewport();
  const { resolvedTheme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  const apiUtils = api.useUtils();

  const createPrimitive = api.primitives.create.useMutation({
    onSuccess: () => {
      apiUtils.flows.byId.invalidate({
        id: flow.id,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePrimitive = api.primitives.update.useMutation({
    onSuccess: () => {
      apiUtils.flows.byId.invalidate({
        id: flow.id,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = createId();

      setNodes((nodes) =>
        nodes.concat({
          id: newNodeId,
          type: "primitive",
          position: { x: Math.floor(position.x), y: Math.floor(position.y) },
          data: {
            id: newNodeId,
            flowId: flow.id,
            conversation: {},
          } as FlowNodeData,
        }),
      );

      await createPrimitive.mutateAsync({
        id: newNodeId,
        flowId: flow.id,
        positionX: Math.floor(position.x),
        positionY: Math.floor(position.y),
      });
    },
    [createPrimitive, flow.id, setNodes, screenToFlowPosition],
  );

  const onNodeDragStop = useCallback(
    async (
      _event: React.MouseEvent,
      node: ReactFlowNode,
      _nodes: ReactFlowNode[],
    ) => {
      await updatePrimitive.mutateAsync({
        where: {
          id: node.id,
        },
        payload: {
          positionX: Math.floor(node.position.x),
          positionY: Math.floor(node.position.y),
        },
      });
    },
    [updatePrimitive],
  );

  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <ReactFlow
      className="rounded-md"
      nodes={nodes}
      onNodesChange={onNodesChange}
      onDrop={onDrop}
      onNodeDragStop={onNodeDragStop}
      onDragOver={onDragOver}
      deleteKeyCode={null}
      nodeTypes={nodeTypes}
      panOnScroll={true}
      maxZoom={1}
      fitView={true}
      colorMode={resolvedTheme as ColorMode}
    >
      <Background
        className="bg-muted dark:bg-background"
        color="hsl(var(--background))"
      />
      <MiniMap
        className="bottom-12"
        bgColor="hsl(var(--background))"
        nodeColor="hsl(var(--accent))"
        maskColor="hsl(var(--accent))"
        position="bottom-right"
        style={{
          height: 100,
          width: 150,
        }}
      />
      <Panel
        position="bottom-right"
        className="flex flex-row rounded-full border bg-background dark:bg-muted p-0.5"
      >
        <Button
          className="w-11 rounded-full"
          variant="ghost"
          size="icon"
          onClick={() => {
            zoomOut();
          }}
        >
          <MinusIcon className="size-4" />
        </Button>
        <Button
          className="w-14 rounded-full text-xs"
          variant="ghost"
          onClick={() => {
            fitView();
          }}
        >
          {`${Math.floor(viewPort.zoom * 100)}%`}
        </Button>
        <Button
          className="w-11 rounded-full"
          variant="ghost"
          size="icon"
          onClick={() => {
            zoomIn();
          }}
        >
          <PlusIcon className="size-4" />
        </Button>
      </Panel>
      <Panel
        position="bottom-center"
        className="flex items-center bg-background dark:bg-muted rounded-full gap-1 p-1 border"
      >
        <FlowSheet initialData={flow} />

        <div className="h-9 border-l" />

        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="inline-flex items-center justify-center size-9 rounded-full hover:bg-accent hover:text-accent-foreground hover:cursor-grab"
              onDragStart={onDragStart}
              draggable
            >
              <BoxIcon className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-muted border">
            <p>Primitive</p>
          </TooltipContent>
        </Tooltip>
      </Panel>
    </ReactFlow>
  );
}
