"use client";

import "reactflow/dist/style.css";
import "~/styles/flow-builder.css";

import type { Connection, Edge, Node, ReactFlowInstance } from "reactflow";
import React, { useCallback, useState } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";

import { QueryResourceNode } from "~/components/query-resource-node";

const initNodes: Node[] = [];

const initEdges: Edge[] = [];

const nodeTypes = {
  queryResourceNode: QueryResourceNode,
};

let id = 1;
const getId = () => `query${id++}`;

export function FlowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");

      console.log(type);

      // check if the dropped element is valid
      if (typeof type === "undefined" || !type) return;

      if (reactFlowInstance === null) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = getId();
      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: { id: `${newNodeId}` },
      };

      setNodes((nodes) => nodes.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        panOnScroll
        maxZoom={1}
        fitView
      >
        <Background
          className="bg-background"
          color="hsl(var(--muted-foreground))"
          size={1}
          gap={25}
        />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
