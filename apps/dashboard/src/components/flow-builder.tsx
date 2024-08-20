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
  ReactFlowProvider,
  addEdge,
  getOutgoers,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  MinusIcon,
  PlayCircleIcon,
  PlusIcon,
  ScanIcon,
  ShareIcon,
} from "lucide-react";
import type React from "react";
import { useCallback } from "react";

import "@xyflow/react/dist/base.css";
import "~/styles/flow-builder.css";

import { Button } from "@integramind/ui/button";

import type { Primitive, PrimitiveType } from "@integramind/shared/types";
import { useTheme } from "next-themes";
import DeletableEdge from "~/components/deletable-edge";
import { PrimitivesMenu } from "~/components/primitives-menu";
import { ConditionalBranch } from "~/components/primitives/conditional-branch";
import { FunctionNode } from "~/components/primitives/function";
import { Iterator } from "~/components/primitives/iterator";
import { Response } from "~/components/primitives/response";
import { Route } from "~/components/primitives/route";
import { Workflow } from "~/components/primitives/workflow";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode } from "~/types";

const nodeTypes = {
  route: Route,
  workflow: Workflow,
  function: FunctionNode,
  "conditional-branch": ConditionalBranch,
  iterator: Iterator,
  response: Response,
};

const edgeTypes = {
  "deletable-edge": DeletableEdge,
};

export function _FlowBuilder({
  flowId,
  initialNodes,
  initialEdges,
}: {
  flowId: string;
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
}) {
  const reactFlow = useReactFlow();
  const viewPort = useViewport();
  const { resolvedTheme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const createPrimitive = api.primitives.create.useMutation();
  const deletePrimitive = api.primitives.delete.useMutation();
  const updatePrimitive = api.primitives.update.useMutation();

  const createEdge = api.edges.create.useMutation();

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
          target: connection.target,
          flowId,
        });
      }
    },
    [flowId, setEdges, createEdge],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const getNewNodeName = (nodeType: PrimitiveType) => {
        switch (nodeType) {
          case "function":
            return "new-function";
          case "conditional-branch":
            return "new-conditional-branch";
          case "iterator":
            return "new-iterator";
          case "response":
            return "new-response";
          case "route":
          case "workflow":
            throw new Error("Invalid node type");
        }
      };

      const nodeType = event.dataTransfer.getData("application/reactflow") as
        | "function"
        | "conditional-branch"
        | "iterator"
        | "response";

      // check if the dropped element is valid
      if (typeof nodeType === "undefined" || !nodeType) return;

      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeName = getNewNodeName(nodeType);

      const newNode = await createPrimitive.mutateAsync({
        type: nodeType,
        name: newNodeName,
        positionX: Math.floor(position.x),
        positionY: Math.floor(position.y),
        flowId,
        metadata: {},
      });

      setNodes((nodes) =>
        nodes.concat({
          id: newNode.id,
          type: newNode.type,
          position: { x: newNode.positionX, y: newNode.positionY },
          data: {
            id: newNode.id,
            name: newNode.name,
            description: newNode.description,
            type: newNode.type,
            metadata: newNode.metadata,
            createdAt: newNode.createdAt,
            updatedAt: newNode.updatedAt,
            createdBy: newNode.createdBy,
            flowId: newNode.flowId,
          } as Primitive,
        }),
      );
    },
    [createPrimitive, flowId, reactFlow, setNodes],
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

  const onNodesDelete = useCallback(
    async (nodes: ReactFlowNode[]) => {
      for (const node of nodes) {
        await deletePrimitive.mutateAsync({
          id: node.id,
        });
      }
    },
    [deletePrimitive],
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const target = nodes.find((node) => node.id === connection.target);

      const hasCycle = (node: Node, visited = new Set()) => {
        if (visited.has(node.id)) return false;

        visited.add(node.id);

        for (const outgoer of getOutgoers(node, nodes, edges)) {
          if (outgoer.id === connection.source) return true;
          if (hasCycle(outgoer, visited)) return true;
        }
      };

      if (!target) return false;

      if (target?.id === connection.source) return false;

      return !hasCycle(target);
    },
    [nodes, edges],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onDrop={onDrop}
      onNodeDragStop={onNodeDragStop}
      onDragOver={onDragOver}
      onNodesDelete={onNodesDelete}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      panOnScroll={true}
      maxZoom={1}
      fitView={true}
      colorMode={resolvedTheme as ColorMode}
    >
      <Background
        className="border rounded-xl bg-background"
        color="hsl(var(--background))"
      />
      <MiniMap
        className="bottom-11"
        bgColor="hsl(var(--background))"
        nodeColor="hsl(var(--accent))"
        maskColor="hsl(var(--accent))"
        position="bottom-left"
        style={{
          height: 110,
          width: 172,
        }}
      />
      <Panel
        position="bottom-left"
        className="flex bg-background flex-row rounded-xl border"
      >
        <Button
          className="rounded-xl rounded-r-none"
          variant="ghost"
          size="icon"
          onClick={() => {
            reactFlow.zoomOut();
          }}
        >
          <MinusIcon className="size-4" />
        </Button>
        <Button
          className="w-16 rounded-none"
          variant="ghost"
          onClick={() => {
            reactFlow.setViewport({
              x: viewPort.x,
              y: viewPort.y,
              zoom: 1,
            });
          }}
        >
          {`${Math.floor(viewPort.zoom * 100)}%`}
        </Button>
        <Button
          className="rounded-none"
          variant="ghost"
          size="icon"
          onClick={() => {
            reactFlow.zoomIn();
          }}
        >
          <PlusIcon className="size-4" />
        </Button>
        <Button
          className="rounded-xl rounded-l-none"
          variant="ghost"
          size="icon"
          onClick={() => {
            reactFlow.fitView();
          }}
        >
          <ScanIcon className="size-4" />
        </Button>
      </Panel>
      <Panel position="top-right">
        <PrimitivesMenu />
      </Panel>
      <Panel position="bottom-right">
        <div className="flex w-full flex-row items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex min-w-24 max-w-min flex-row items-center justify-center gap-1 bg-background text-success hover:bg-success/10 hover:text-success"
          >
            <PlayCircleIcon className="size-3.5" />
            Run
          </Button>
          <Button
            size="sm"
            className="flex min-w-24 max-w-min flex-row items-center justify-center gap-1"
          >
            <ShareIcon className="size-3.5" />
            Deploy
          </Button>
        </div>
      </Panel>
    </ReactFlow>
  );
}

export function FlowBuilder({
  flowId,
  initialNodes,
  initialEdges,
}: {
  flowId: string;
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
}) {
  return (
    <ReactFlowProvider>
      <_FlowBuilder
        flowId={flowId}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
      />
    </ReactFlowProvider>
  );
}
