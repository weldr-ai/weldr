"use client";

import "reactflow/dist/style.css";
import "~/styles/flow-builder.css";

import type { Connection, Edge } from "reactflow";
import React, { useCallback } from "react";
import { Minus, Plus, Scan } from "lucide-react";
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

import { Button } from "@integramind/ui/button";

import type { Block, BlockType, FlowEdge } from "~/types";
import { AccessPointBlock } from "~/components/access-point-block";
import { ActionBlock } from "~/components/action-block";
import { AIProcessingBlock } from "~/components/ai-processing-block";
import { BlocksMenu } from "~/components/blocks-menu";
import DeletableEdge from "~/components/deletable-edge";
import { LogicalBranchBlock } from "~/components/logical-branch-block";
import { LogicalProcessingBlock } from "~/components/logical-processing-block";
import { QueryBlock } from "~/components/query-block";
import { ResponseBlock } from "~/components/response-block";
import { SemanticBranchBlock } from "~/components/semantic-branch-block";
import { WorkflowBlock } from "~/components/workflow-block";

const blockTypes = {
  "access-point-block": AccessPointBlock,
  "workflow-block": WorkflowBlock,
  "query-block": QueryBlock,
  "action-block": ActionBlock,
  "logical-processing-block": LogicalProcessingBlock,
  "ai-processing-block": AIProcessingBlock,
  "logical-branch-block": LogicalBranchBlock,
  "semantic-branch-block": SemanticBranchBlock,
  "response-block": ResponseBlock,
};

const edgeTypes = {
  "deletable-edge": DeletableEdge,
};

export function _FlowBuilder({
  initialBlocks,
  initialEdges,
}: {
  initialBlocks: Block[];
  initialEdges: FlowEdge[];
}) {
  const reactFlow = useReactFlow();
  const viewPort = useViewport();
  const [blocks, setBlocks, onBlocksChange] = useNodesState(initialBlocks);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Edge | Connection) =>
      setEdges((eds) => addEdge({ ...params, type: "deletable-edge" }, eds)),
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

      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newBlockId = crypto.randomUUID();

      const getNewBockName = (blockType: BlockType) => {
        switch (blockType) {
          case "access-point-block":
            return "New Access Point";
          case "workflow-block":
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
    [reactFlow, setBlocks],
  );

  return (
    <ReactFlow
      nodes={blocks}
      edges={edges}
      onNodesChange={onBlocksChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDrop={onDrop}
      onDragOver={onDragOver}
      nodeTypes={blockTypes}
      edgeTypes={edgeTypes}
      deleteKeyCode={null}
      panOnScroll={true}
      maxZoom={1}
      fitView={true}
    >
      <Background className="bg-background" color="hsl(var(--background))" />
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
          <Minus className="size-4" />
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
          <Plus className="size-4" />
        </Button>
        <Button
          className="rounded-xl rounded-l-none"
          variant="ghost"
          size="icon"
          onClick={() => {
            reactFlow.fitView();
          }}
        >
          <Scan className="size-4" />
        </Button>
      </Panel>
      <Panel position="top-right">
        <BlocksMenu />
      </Panel>
    </ReactFlow>
  );
}

export function FlowBuilder({
  initialBlocks,
  initialEdges,
}: {
  initialBlocks: Block[];
  initialEdges: FlowEdge[];
}) {
  return (
    <ReactFlowProvider>
      <_FlowBuilder initialBlocks={initialBlocks} initialEdges={initialEdges} />
    </ReactFlowProvider>
  );
}
