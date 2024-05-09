"use client";

import "reactflow/dist/style.css";
import "~/styles/flow-builder.css";

import type { Connection, Edge } from "reactflow";
import { useCallback } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
} from "reactflow";

const initNodes = [
  {
    id: "1",
    data: { name: "Jane Doe", job: "CEO", emoji: "😎" },
    position: { x: 0, y: 50 },
  },
  {
    id: "2",
    data: { name: "Tyler Weary", job: "Designer", emoji: "🤓" },

    position: { x: -200, y: 200 },
  },
  {
    id: "3",
    data: { name: "Kristi Price", job: "Developer", emoji: "🤩" },
    position: { x: 200, y: 200 },
  },
];

const initEdges = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
  },
  {
    id: "e1-3",
    source: "1",
    target: "3",
  },
];

export function FlowBuilder() {
  const [nodes, _, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
    >
      <Background
        className="bg-muted"
        color="hsl(var(--muted-foreground))"
        size={1}
        gap={15}
      />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
