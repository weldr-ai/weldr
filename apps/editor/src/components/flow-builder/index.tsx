"use client";

import { createId } from "@paralleldrive/cuid2";
import type { ColorMode, Edge, Node as ReactFlowNode } from "@xyflow/react";
import {
  Background,
  MiniMap,
  Panel,
  ReactFlow,
  SmoothStepEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  EyeIcon,
  EyeOffIcon,
  FunctionSquareIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect } from "react";

import type { FlowNode, FlowNodeData } from "~/types";

import "@xyflow/react/dist/base.css";
import "~/styles/flow-builder.css";

import { Button } from "@integramind/ui/button";

import type { Flow, FlowEdge } from "@integramind/shared/types";
import { useTheme } from "@integramind/ui/theme-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import { toast } from "@integramind/ui/use-toast";
import { FlowSheet } from "~/components/flow-sheet";
import { useFlowBuilderStore } from "~/lib/store";
import { api } from "~/lib/trpc/client";
import { PrimitiveNode } from "./primitives";

const nodeTypes = {
  primitive: PrimitiveNode,
};

const edgeTypes = {
  smoothstep: SmoothStepEdge,
};

export function FlowBuilder({
  flow,
  initialNodes,
  initialEdges,
}: {
  flow: Flow;
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
}) {
  const showEdges = useFlowBuilderStore((state) => state.showEdges);
  const toggleEdges = useFlowBuilderStore((state) => state.toggleEdges);

  const { data: edgesData } = api.edges.listByFlowId.useQuery(
    {
      flowId: flow.id,
    },
    {
      initialData: initialEdges,
    },
  );

  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const viewPort = useViewport();
  const { resolvedTheme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    showEdges ? [] : [],
  );

  useEffect(() => {
    setEdges(
      edgesData.map((edge) => ({
        id: edge.id,
        source: edge.localSourceId,
        target: edge.targetId,
      })) as Edge[],
    );
  }, [edgesData, setEdges]);

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
            flow: {
              inputSchema: flow.inputSchema,
            },
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
    [
      createPrimitive,
      flow.id,
      setNodes,
      screenToFlowPosition,
      flow.inputSchema,
    ],
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
      edges={showEdges ? edges : []}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      edgeTypes={edgeTypes}
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
          height: 110,
          width: 176,
        }}
      />
      <Panel
        position="bottom-right"
        className="flex flex-row items-center rounded-full border bg-background dark:bg-muted p-0.5 space-x-0.5"
      >
        <div className="flex flex-row items-center">
          <Button
            className="rounded-full"
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
            className="rounded-full"
            variant="ghost"
            size="icon"
            onClick={() => {
              zoomIn();
            }}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
        <div className="h-9 border-l" />
        <Button
          className="rounded-full"
          variant="ghost"
          size="icon"
          onClick={toggleEdges}
        >
          {showEdges ? (
            <EyeIcon className="size-4" />
          ) : (
            <EyeOffIcon className="size-4" />
          )}
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
              aria-disabled={!flow.inputSchema}
              draggable={!!flow.inputSchema}
            >
              <FunctionSquareIcon className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-muted border">
            <p>Function</p>
          </TooltipContent>
        </Tooltip>
      </Panel>
    </ReactFlow>
  );
}
