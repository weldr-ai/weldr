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
import { MinusIcon, PlayIcon, PlusIcon, RocketIcon } from "lucide-react";
import type React from "react";
import { useCallback } from "react";

import "@xyflow/react/dist/base.css";
import "~/styles/flow-builder.css";

import { Button } from "@specly/ui/button";

import type { Primitive, PrimitiveType } from "@specly/shared/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@specly/ui/tooltip";
import { toast } from "@specly/ui/use-toast";
import { useTheme } from "next-themes";
import DeletableEdge from "~/components/deletable-edge";
import { Response } from "~/components/primitives/response";
import { Route } from "~/components/primitives/route";
import { Workflow } from "~/components/primitives/workflow";
import { api } from "~/lib/trpc/react";
import type { FlowEdge, FlowNode } from "~/types";
import { PrimitivesMenu } from "./primitives-menu";
import { FunctionNodeV2 } from "./primitives/function-v2";

const nodeTypes = {
  route: Route,
  workflow: Workflow,
  function: FunctionNodeV2,
  // matcher: Matcher,
  // iterator: Iterator,
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
  const {
    getIntersectingNodes,
    screenToFlowPosition,
    zoomIn,
    zoomOut,
    fitView,
  } = useReactFlow();
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

  // const getIterator = useCallback(
  //   (nodes: Node[], intersectingNodes: string[]) =>
  //     nodes.find(
  //       (n) => n.type === "iterator" && intersectingNodes.includes(n.id),
  //     ),
  //   [],
  // );

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

      const nodeType = event.dataTransfer.getData("application/reactflow") as
        | "function"
        | "matcher"
        | "iterator"
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
            metadata: {},
            flowId,
          } as Primitive,
        }),
      );

      await createPrimitive.mutateAsync({
        id: newNodeId,
        type: nodeType,
        positionX: Math.floor(position.x),
        positionY: Math.floor(position.y),
        flowId,
        metadata: {},
      });
    },
    [createPrimitive, flowId, setNodes, screenToFlowPosition],
  );

  const onNodeDrag = useCallback(
    (event: React.MouseEvent, node: Node, _nodes: Node[]) => {
      const intersections = getIntersectingNodes(node).map((n) => n.id);
      setNodes((ns) =>
        ns.map((n) => ({
          ...n,
          className:
            intersections.includes(n.id) &&
            n.type === "iterator" &&
            (node.type === "function" || node.type === "matcher") &&
            !node.parentId
              ? "rounded-lg shadow-[0_0_1px_#3E63DD,inset_0_0_1px_#3E63DD,0_0_1px_#3E63DD,0_0_5px_#3E63DD,0_0_10px_#3E63DD] transition-shadow duration-300"
              : "",
        })),
      );
    },
    [setNodes, getIntersectingNodes],
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
          flowId,
        },
        payload: {
          type: node.type as PrimitiveType,
          positionX: Math.floor(node.position.x),
          positionY: Math.floor(node.position.y),
        },
      });

      // const intersectingNodes = getIntersectingNodes(node).map((n) => n.id);
      // const parent = getIterator(nodes, intersectingNodes);

      // if (
      //   parent &&
      //   !node.parentId &&
      //   (node.type === "matcher" || node.type === "function")
      // ) {
      //   setNodes(
      //     nodes
      //       .sort((a, b) =>
      //         a.type === "iterator" ? -1 : b.type === "iterator" ? 1 : 0,
      //       )
      //       .map((n) =>
      //         n.id === node.id
      //           ? {
      //               ...node,
      //               position: {
      //                 x: node.position.x - parent.position.x,
      //                 y: node.position.y - parent.position.y,
      //               },
      //               parentId: parent.id,
      //               extent: "parent",
      //             }
      //           : n.type === "iterator"
      //             ? {
      //                 ...n,
      //                 className: "",
      //               }
      //             : n,
      //       ) as FlowNode[],
      //   );

      //   await updatePrimitive.mutateAsync({
      //     where: {
      //       id: node.id,
      //       flowId,
      //     },
      //     payload: {
      //       type: node.type as PrimitiveType,
      //       parentId: parent.id,
      //       positionX: Math.floor(node.position.x - parent.position.x),
      //       positionY: Math.floor(node.position.y - parent.position.y),
      //     },
      //   });
      // } else {
      //   await updatePrimitive.mutateAsync({
      //     where: {
      //       id: node.id,
      //       flowId,
      //     },
      //     payload: {
      //       type: node.type as PrimitiveType,
      //       positionX: Math.floor(node.position.x),
      //       positionY: Math.floor(node.position.y),
      //     },
      //   });
      // }
    },
    [updatePrimitive, flowId],
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const source = nodes.find((node) => node.id === connection.source);
      const target = nodes.find((node) => node.id === connection.target);

      if (!target || !source) return false;
      if (source.id === target.id) return false;

      // Check for iterator input source handle connection
      if (
        source.type === "iterator" &&
        connection.sourceHandle === `${source.id}-iterator-input-source`
      ) {
        return target.parentId === source.id;
      }

      // Check for iterator output target handle connection
      if (
        target.type === "iterator" &&
        connection.targetHandle === `${target.id}-iterator-output-target`
      ) {
        return source.parentId === target.id;
      }

      if (source.parentId !== target.parentId) return false;

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
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onDrop={onDrop}
      onNodeDrag={onNodeDrag}
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
        position="top-right"
        className="flex flex-col items-center bg-background dark:bg-muted rounded-full gap-0.5 p-0.5 border"
      >
        <PrimitivesMenu />

        <div className="w-9 border-t" />

        <Tooltip>
          <TooltipTrigger>
            <Button
              className="rounded-full hover:bg-success/20 text-success"
              variant="ghost"
              size="icon"
            >
              <PlayIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="bg-muted border text-success">
            <p>Run</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger>
            <Button
              className="rounded-full hover:bg-primary/20 text-primary"
              variant="ghost"
              size="icon"
            >
              <RocketIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="bg-muted border text-primary">
            <p>Ship</p>
          </TooltipContent>
        </Tooltip>
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
