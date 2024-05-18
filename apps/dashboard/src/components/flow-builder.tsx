"use client";

import "reactflow/dist/style.css";
import "~/styles/flow-builder.css";

// import type { HierarchyPointNode } from "d3-hierarchy";
import type { Connection, Edge, Node, ReactFlowInstance } from "reactflow";
import React, { useCallback, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
// import { stratify, tree } from "d3-hierarchy";
import ReactFlow, {
  addEdge,
  Background,
  Panel,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";

import { EntryNode } from "~/components/entry-node";
import FlowEdge from "~/components/flow-edge";
import { OraclesMenu } from "~/components/oracles-menu";
import { QueryResourceNode } from "~/components/query-resource-node";

// const NODE_WIDTH = 4 * 20;
// const NODE_HEIGHT = 4 * 10;

const nodeTypes = {
  "entry-node": EntryNode,
  "query-resource-node": QueryResourceNode,
};

const edgeTypes = {
  "flow-edge": FlowEdge,
};

const initialNodeId = createId();

const initNodes: Node[] = [
  {
    id: initialNodeId,
    type: "entry-node",
    position: {
      x: 0,
      y: 0,
    },
    data: { id: initialNodeId, name: "My new route" },
  },
];

const initEdges: Edge[] = [];

// const g = tree();

// const getLayoutedElements = (
//   nodes: Node[],
//   edges: Edge[],
// ): { nodes: Node[]; edges: Edge[] } => {
//   if (nodes.length === 0) return { nodes, edges };

//   const hierarchy = stratify()
//     .id((node) => (node as Node).id)
//     .parentId(
//       (node) => edges.find((edge) => edge.target === (node as Node).id)?.source,
//     );

//   const root = hierarchy(nodes);
//   const layout = g.nodeSize([NODE_WIDTH * 2, NODE_HEIGHT * 2])(root);

//   return {
//     nodes: layout.descendants().map(
//       (node) =>
//         ({
//           ...(node as HierarchyPointNode<Node>).data,
//           position: { x: node.x, y: node.y },
//         }) as Node,
//     ),
//     edges,
//   };
// };

export function _FlowBuilder() {
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  // const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
  //   nodes,
  //   edges,
  // );

  const onConnect = useCallback(
    (params: Edge | Connection) =>
      setEdges((eds) => addEdge({ ...params, type: "flow-edge" }, eds)),
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

      // check if the dropped element is valid
      if (typeof type === "undefined" || !type) return;

      if (reactFlowInstance === null) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = createId();

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
      edgeTypes={edgeTypes}
      panOnScroll
      maxZoom={1}
      fitView
    >
      <Background className="bg-background" color="hsl(var(--background))" />
      <Panel position="top-right">
        <OraclesMenu />
      </Panel>
    </ReactFlow>
  );
}

export function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <_FlowBuilder />
    </ReactFlowProvider>
  );
}
