"use client";

import { createId } from "@paralleldrive/cuid2";
import {
  MinusIcon,
  PlayCircleIcon,
  PlusIcon,
  ScanIcon,
  ShareIcon,
} from "lucide-react";
import type React from "react";
import { useCallback } from "react";
import type {
  Connection,
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
} from "reactflow";
import ReactFlow, {
  addEdge,
  Background,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
} from "reactflow";

import "reactflow/dist/style.css";
import "~/styles/flow-builder.css";

import type { PrimitiveMetadata } from "@integramind/db/types";
import { Button } from "@integramind/ui/button";

import DeletableEdge from "~/components/deletable-edge";
import { PrimitivesMenu } from "~/components/primitives-menu";
import { ConditionalBranch } from "~/components/primitives/conditional-branch";
import { FunctionNode } from "~/components/primitives/function";
import { Iterator } from "~/components/primitives/iterator";
import { Response } from "~/components/primitives/response";
import { Route } from "~/components/primitives/route";
import { Workflow } from "~/components/primitives/workflow";
import { createEdge } from "~/lib/queries/edges";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode, PrimitiveType } from "~/types";

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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const createPrimitive = api.primitives.create.useMutation();
  const deletePrimitive = api.primitives.delete.useMutation();
  const updatePrimitive = api.primitives.update.useMutation();

  const onConnect = useCallback(
    async (params: ReactFlowEdge | Connection) => {
      const newEdgeId = createId();
      setEdges((eds) => addEdge({ ...params, type: "deletable-edge" }, eds));

      if (params.source && params.target) {
        await createEdge({
          id: newEdgeId,
          source: params.source,
          target: params.target,
          flowId: flowId,
        });
      }
    },
    [flowId, setEdges],
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
            return "New Function";
          case "conditional-branch":
            return "New Conditional Branch";
          case "iterator":
            return "New Iterator";
          case "response":
            return "New Response";
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

      const newNodeId = createId();
      const newNodeName = getNewNodeName(nodeType);

      setNodes((nodes) =>
        nodes.concat({
          id: newNodeId,
          type: nodeType,
          position: { x: Math.floor(position.x), y: Math.floor(position.y) },
          data: { id: newNodeId, name: newNodeName, type: nodeType },
        } as FlowNode),
      );

      await createPrimitive.mutateAsync({
        id: newNodeId,
        type: nodeType,
        name: newNodeName,
        positionX: Math.floor(position.x),
        positionY: Math.floor(position.y),
        flowId,
        metadata: {
          type: nodeType,
        } as PrimitiveMetadata,
      });
    },
    [createPrimitive, flowId, reactFlow, setNodes],
  );

  const onNodeDragStop = useCallback(
    async (
      _event: React.MouseEvent,
      node: ReactFlowNode,
      _nodes: ReactFlowNode[],
    ) => {
      await updatePrimitive.mutate({
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

  const onNodesDelete = useCallback(
    async (nodes: ReactFlowNode[]) => {
      for (const node of nodes) {
        deletePrimitive.mutate({
          id: node.id,
        });
      }
    },
    [deletePrimitive],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDrop={onDrop}
      onNodeDragStop={onNodeDragStop}
      onDragOver={onDragOver}
      onNodesDelete={onNodesDelete}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      panOnScroll={true}
      maxZoom={1}
      fitView={true}
    >
      <Background
        className="rounded-xl bg-[#F0F0F3] dark:bg-background"
        color="hsl(var(--background))"
      />
      <MiniMap
        className="bottom-11 bg-[#F0F0F3] dark:bg-background"
        position="bottom-left"
        style={{
          height: 100,
          width: 172,
        }}
        nodeColor="hsl(var(--muted-foreground))"
        maskColor="hsl(var(--muted-foreground))"
      />
      <Panel
        position="bottom-left"
        className="flex flex-row rounded-xl border bg-background dark:bg-muted"
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
