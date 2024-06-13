"use client";

import type { Connection, Edge, Node } from "reactflow";
import React, { useCallback } from "react";
import { createId } from "@paralleldrive/cuid2";
import { useMutation } from "@tanstack/react-query";
import {
  MinusIcon,
  PlayCircleIcon,
  PlusIcon,
  ScanIcon,
  ShareIcon,
} from "lucide-react";
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

import { Button } from "@integramind/ui/button";

import type { FlowEdge, FlowNode, PrimitiveType } from "~/types";
import DeletableEdge from "~/components/deletable-edge";
import { PrimitivesMenu } from "~/components/primitives-menu";
import { createEdge } from "~/lib/queries/edges";
import {
  createPrimitive,
  updatePrimitivePosition,
} from "~/lib/queries/primitives";
import { ConditionalBranch } from "./primitives/conditional-branch";
import { Function } from "./primitives/function";
import { Loop } from "./primitives/loop";
import { Response } from "./primitives/response";
import { Route } from "./primitives/route";
import { Workflow } from "./primitives/workflow";

const nodeTypes = {
  route: Route,
  workflow: Workflow,
  function: Function,
  "conditional-branch": ConditionalBranch,
  loop: Loop,
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

  const createPrimitiveMutation = useMutation({
    mutationFn: createPrimitive,
  });
  const updatePrimitivePositionMutation = useMutation({
    mutationFn: updatePrimitivePosition,
  });
  const createFlowEdgeMutation = useMutation({
    mutationFn: createEdge,
  });

  const onConnect = useCallback(
    async (params: Edge | Connection) => {
      const newEdgeId = createId();
      setEdges((eds) => addEdge({ ...params, type: "deletable-edge" }, eds));
      await createFlowEdgeMutation.mutateAsync({
        id: newEdgeId,
        source: params.source!,
        target: params.target!,
        flowId: flowId,
      });
    },
    [flowId, setEdges, createFlowEdgeMutation],
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
          case "route":
            return "New Route";
          case "workflow":
            return "New Workflow";
          case "function":
            return "New Function";
          case "conditional-branch":
            return "New Conditional Branch";
          case "loop":
            return "New Loop";
          case "response":
            return "New Response";
        }
      };

      const nodeType = event.dataTransfer.getData(
        "application/reactflow",
      ) as PrimitiveType;

      // check if the dropped element is valid
      if (typeof nodeType === "undefined" || !nodeType) return;

      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = createId();
      const newNodeName = getNewNodeName(nodeType);

      const newNode: FlowNode = {
        id: newNodeId,
        type: nodeType,
        position,
        data: { id: newNodeId, name: newNodeName },
      };

      setNodes((nodes) => nodes.concat(newNode));

      if (nodeType === "function") {
        await createPrimitiveMutation.mutateAsync({
          id: newNodeId,
          type: nodeType,
          name: newNodeName,
          flowId: flowId,
          positionX: position.x,
          positionY: position.y,
        });
      }
    },
    [createPrimitiveMutation, flowId, reactFlow, setNodes],
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node, _nodes: Node[]) => {
      updatePrimitivePositionMutation.mutate({
        id: node.id,
        positionX: Math.floor(node.position.x),
        positionY: Math.floor(node.position.y),
      });
    },
    [updatePrimitivePositionMutation],
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
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      deleteKeyCode={null}
      panOnScroll={true}
      maxZoom={1}
      fitView={true}
    >
      <Background
        className="rounded-xl bg-accent dark:bg-background"
        color="hsl(var(--background))"
      />
      <MiniMap
        className="bottom-11 bg-background"
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
        className="flex flex-row rounded-xl border bg-muted"
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
        <div className="flex w-full flex-row items-center justify-end gap-2 px-4">
          <Button
            size="sm"
            variant="outline"
            className="flex min-w-24 max-w-min flex-row items-center justify-center gap-1 border border-success bg-transparent text-success hover:bg-success/10 hover:text-success"
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
