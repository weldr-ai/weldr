"use client";

import "reactflow/dist/style.css";
import "~/styles/flow-builder.css";

import type { Connection, Edge, ReactFlowInstance } from "reactflow";
import React, { useCallback, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import ReactFlow, {
  addEdge,
  Background,
  Panel,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";

import type { Block, BlockType, TRouteEntryBlock } from "~/types";
import { ActionBlock } from "~/components/action-block";
import { AIProcessingBlock } from "~/components/ai-processing-block";
import { BlocksMenu } from "~/components/blocks-menu";
import { LogicalBranchBlock } from "~/components/logical-branch-block";
import { LogicalProcessingBlock } from "~/components/logical-processing-block";
import { QueryBlock } from "~/components/query-block";
import { ResponseBlock } from "~/components/response-block";
import { RouteEntryBlock } from "~/components/route-entry-block";
import { SemanticBranchBlock } from "~/components/semantic-branch-block";
import { WorkflowEntryBlock } from "~/components/workflow-entry-block";

const blockTypes = {
  "route-entry-block": RouteEntryBlock,
  "workflow-entry-block": WorkflowEntryBlock,
  "query-block": QueryBlock,
  "action-block": ActionBlock,
  "logical-processing-block": LogicalProcessingBlock,
  "ai-processing-block": AIProcessingBlock,
  "logical-branch-block": LogicalBranchBlock,
  "semantic-branch-block": SemanticBranchBlock,
  "response-block": ResponseBlock,
};

const initialBlockId = createId();

const initialBlocks: Block[] = [
  {
    id: initialBlockId,
    type: "route-entry-block",
    position: {
      x: 0,
      y: 0,
    },
    data: {
      id: initialBlockId,
      name: "New API Route",
      method: "GET",
      urlPath: "/",
    },
  } as TRouteEntryBlock,
];

const initEdges: Edge[] = [];

export function _FlowBuilder() {
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [blocks, setBlocks, onBlocksChange] = useNodesState(initialBlocks);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  const onConnect = useCallback(
    (params: Edge | Connection) =>
      setEdges((eds) => addEdge({ ...params }, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const blockType = event.dataTransfer.getData(
        "application/reactflow",
      ) as BlockType;

      // check if the dropped element is valid
      if (typeof blockType === "undefined" || !blockType) return;

      if (reactFlowInstance === null) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newBlockId = createId();

      const getNewBockName = (blockType: BlockType) => {
        switch (blockType) {
          case "route-entry-block":
            return "New API Route";
          case "workflow-entry-block":
            return "New Workflow";
          case "query-block":
            return "New Query";
          case "action-block":
            return "New Action";
          case "logical-processing-block":
            return "New Logical Processing";
          case "ai-processing-block":
            return "New AI Processing";
          case "logical-branch-block":
            return "New Logical Branch";
          case "semantic-branch-block":
            return "New Semantic Branch";
          case "response-block":
            return "New Response";
        }
      };

      const newBlock: Block = {
        id: newBlockId,
        type: blockType,
        position,
        data: { id: `${newBlockId}`, name: getNewBockName(blockType) },
      };

      setBlocks((blocks) => blocks.concat(newBlock));
    },
    [reactFlowInstance, setBlocks],
  );

  return (
    <ReactFlow
      nodes={blocks}
      edges={edges}
      onNodesChange={onBlocksChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onInit={setReactFlowInstance}
      onDrop={onDrop}
      onDragOver={onDragOver}
      nodeTypes={blockTypes}
      panOnScroll
      maxZoom={1}
      fitView
    >
      <Background className="bg-background" color="hsl(var(--background))" />
      <Panel position="top-right">
        <BlocksMenu />
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
