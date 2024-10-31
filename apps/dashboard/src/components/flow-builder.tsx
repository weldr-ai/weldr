"use client";

import { createId } from "@paralleldrive/cuid2";
import type {
  ColorMode,
  Connection,
  Edge,
  Node,
  Node as ReactFlowNode,
} from "@xyflow/react";
import {
  Background,
  MiniMap,
  Panel,
  ReactFlow,
  addEdge,
  getOutgoers,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { MinusIcon, PlusIcon } from "lucide-react";
import type React from "react";
import { useCallback } from "react";

import "@xyflow/react/dist/base.css";
import "~/styles/flow-builder.css";

import { Button } from "@specly/ui/button";

import type { Flow, PrimitiveType } from "@specly/shared/types";
import { toast } from "@specly/ui/use-toast";
import { useTheme } from "next-themes";
import DeletableEdge from "~/components/deletable-edge";
import { PrimitivesMenu } from "~/components/primitives-menu";
import { FunctionNode } from "~/components/primitives/function";
import { Response } from "~/components/primitives/response";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode, FlowNodeData } from "~/types";
import { FlowSheet } from "./flow-sheet";

const nodeTypes = {
  function: FunctionNode,
  response: Response,
};

const edgeTypes = {
  "deletable-edge": DeletableEdge,
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
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const viewPort = useViewport();
  const { resolvedTheme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const createPrimitive = api.primitives.create.useMutation({
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePrimitive = api.primitives.update.useMutation({
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createEdge = api.edges.create.useMutation({
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onConnect = useCallback(
    async (connection: Connection) => {
      const newEdgeId = createId();

      setEdges((eds) =>
        addEdge({ ...connection, type: "deletable-edge" }, eds),
      );

      if (connection.source && connection.target) {
        await createEdge.mutateAsync({
          id: newEdgeId,
          source: connection.source,
          sourceHandle: connection.sourceHandle,
          target: connection.target,
          targetHandle: connection.targetHandle,
          flowId: flow.id,
        });
      }
    },
    [flow.id, setEdges, createEdge],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData("application/reactflow") as
        | "function"
        | "response";

      // check if the dropped element is valid
      if (typeof nodeType === "undefined" || !nodeType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = createId();

      setNodes((nodes) =>
        nodes.concat({
          id: newNodeId,
          type: nodeType,
          position: { x: Math.floor(position.x), y: Math.floor(position.y) },
          data: {
            id: newNodeId,
            type: nodeType,
            flowId: flow.id,
          } as FlowNodeData,
        }),
      );

      await createPrimitive.mutateAsync({
        id: newNodeId,
        type: nodeType,
        positionX: Math.floor(position.x),
        positionY: Math.floor(position.y),
        flowId: flow.id,
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
          type: node.type as PrimitiveType,
          positionX: Math.floor(node.position.x),
          positionY: Math.floor(node.position.y),
        },
      });
    },
    [updatePrimitive],
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const source = nodes.find((node) => node.id === connection.source);
      const target = nodes.find((node) => node.id === connection.target);

      if (!target || !source) return false;
      if (source.id === target.id) return false;

      const hasCycle = (node: Node, visited = new Set()) => {
        if (visited.has(node.id)) return false;

        visited.add(node.id);

        for (const outgoer of getOutgoers(node, nodes, edges)) {
          if (outgoer.id === source.id) return true;
          if (hasCycle(outgoer, visited)) return true;
        }
      };

      return !hasCycle(target);
    },
    [nodes, edges],
  );

  return (
    <ReactFlow
      className="rounded-md"
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onDrop={onDrop}
      onNodeDragStop={onNodeDragStop}
      onDragOver={onDragOver}
      deleteKeyCode={null}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
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

        <PrimitivesMenu />
      </Panel>
    </ReactFlow>
  );
}
