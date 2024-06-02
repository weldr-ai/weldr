"use client";

import "reactflow/dist/style.css";
import "~/styles/flow-builder.css";

import type { Connection, Edge } from "reactflow";
import React, { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
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

import type { FlowEdge, Primitive, PrimitiveType } from "~/types";
import DeletableEdge from "~/components/deletable-edge";
import { PrimitivesMenu } from "~/components/primitives-menu";
import { updateAccessPointFlowPrimitives } from "~/lib/actions/access-points";
import { updateComponentFlowPrimitives } from "~/lib/actions/components";
import { createFunction } from "~/lib/actions/functions";
import { updateWorkflowFlowPrimitives } from "~/lib/actions/workflows";
import { AccessPoint } from "./primitives/access-point";
import { ConditionalBranch } from "./primitives/conditional-branch";
import { Function } from "./primitives/function";
import { Loop } from "./primitives/loop";
import { Response } from "./primitives/response";
import { Workflow } from "./primitives/workflow";

const primitiveTypes = {
  "access-point": AccessPoint,
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
  flowType,
  initialPrimitives,
  initialEdges,
}: {
  flowId: string;
  flowType: "component" | "workflow" | "access-point";
  initialPrimitives: Primitive[];
  initialEdges: FlowEdge[];
}) {
  const updateFlowPrimitivesMutation = useMutation({
    mutationFn:
      flowType === "component"
        ? updateComponentFlowPrimitives
        : flowType === "access-point"
          ? updateAccessPointFlowPrimitives
          : updateWorkflowFlowPrimitives,
  });
  const createFunctionMutation = useMutation({
    mutationFn: createFunction,
  });

  const reactFlow = useReactFlow();
  const viewPort = useViewport();
  const [primitives, setPrimitives, onPrimitivesChange] =
    useNodesState(initialPrimitives);
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
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const getNewPrimitiveName = (primitiveType: PrimitiveType) => {
        switch (primitiveType) {
          case "access-point":
            return "New Access Point";
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

      const primitiveType = event.dataTransfer.getData(
        "application/reactflow",
      ) as PrimitiveType;

      // check if the dropped element is valid
      if (typeof primitiveType === "undefined" || !primitiveType) return;

      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newPrimitiveId = crypto.randomUUID();
      const newPrimitiveName = getNewPrimitiveName(primitiveType);

      const newPrimitive: Primitive = {
        id: newPrimitiveId,
        type: primitiveType,
        position,
        data: { id: newPrimitiveId, name: newPrimitiveName },
      };

      setPrimitives((primitives) => primitives.concat(newPrimitive));

      if (primitiveType === "function") {
        await createFunctionMutation.mutateAsync({
          id: newPrimitiveId,
          name: getNewPrimitiveName(primitiveType),
        });
        await updateFlowPrimitivesMutation.mutateAsync({
          id: flowId,
          primitive: { id: newPrimitiveId, type: primitiveType },
        });
      }
    },
    [
      reactFlow,
      setPrimitives,
      createFunctionMutation,
      updateFlowPrimitivesMutation,
      flowId,
    ],
  );

  return (
    <ReactFlow
      nodes={primitives}
      edges={edges}
      onNodesChange={onPrimitivesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDrop={onDrop}
      onDragOver={onDragOver}
      nodeTypes={primitiveTypes}
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
        <PrimitivesMenu />
      </Panel>
    </ReactFlow>
  );
}

export function FlowBuilder({
  flowId,
  flowType,
  initialPrimitives,
  initialEdges,
}: {
  flowId: string;
  flowType: "component" | "workflow" | "access-point";
  initialPrimitives: Primitive[];
  initialEdges: FlowEdge[];
}) {
  return (
    <ReactFlowProvider>
      <_FlowBuilder
        flowId={flowId}
        flowType={flowType}
        initialPrimitives={initialPrimitives}
        initialEdges={initialEdges}
      />
    </ReactFlowProvider>
  );
}
