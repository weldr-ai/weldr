"use client";

import type { ColorMode, Edge } from "@xyflow/react";
import {
  Background,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  AppWindowIcon,
  EyeIcon,
  EyeOffIcon,
  FunctionSquareIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import type React from "react";
import { useCallback } from "react";

import type { CanvasNode } from "@/types";

import "@/styles/flow-builder.css";
import "@xyflow/react/dist/base.css";

import { Button } from "@weldr/ui/button";

import { useFlowBuilder } from "@/lib/store";
import { useTheme } from "@weldr/ui/theme-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@weldr/ui/tooltip";

const nodeTypes = {};

export function Canvas({
  projectId,
  initialNodes,
  initialEdges,
}: {
  projectId: string;
  initialNodes: CanvasNode[];
  initialEdges: Edge[];
}) {
  const { showEdges, toggleEdges } = useFlowBuilder();

  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const viewPort = useViewport();
  const { resolvedTheme } = useTheme();
  const [nodes, _setNodes, onNodesChange] =
    useNodesState<CanvasNode>(initialNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  // const apiUtils = api.useUtils();

  // const createNode = api.nodes.create.useMutation({
  //   onSuccess: (data) => {
  //     updateNodeData(data.id, data);
  //     apiUtils.nodes.byId.invalidate({ id: data.id });
  //   },
  //   onError: (error) => {
  //     toast({
  //       title: "Error",
  //       description: error.message,
  //       variant: "destructive",
  //     });
  //   },
  // });

  // const updateNode = api.nodes.update.useMutation({
  //   onError: (error) => {
  //     toast({
  //       title: "Error",
  //       description: error.message,
  //       variant: "destructive",
  //     });
  //   },
  // });

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // const onDrop = useCallback(
  //   async (event: React.DragEvent<HTMLDivElement>) => {
  //     event.preventDefault();

  //     const position = screenToFlowPosition({
  //       x: event.clientX,
  //       y: event.clientY,
  //     });

  //     const type = event.dataTransfer.getData("type") as
  //       | "page"
  //       | "function"
  //       | "endpoint";

  //     const newNodeId = createId();
  //     const newNode: CanvasNode = {
  //       id: newNodeId,
  //       type,
  //       position: {
  //         x: position.x,
  //         y: position.y,
  //       },
  //     } as CanvasNode;

  //     await createNode.mutateAsync({
  //       id: newNodeId,
  //       projectId,
  //       type,
  //       position: {
  //         x: position.x,
  //         y: position.y,
  //       },
  //     });

  //     setNodes((nodes) => nodes.concat(newNode));
  //   },
  //   [createNode, setNodes, screenToFlowPosition, projectId],
  // );

  // const onNodeDragStop = useCallback(
  //   async (
  //     _event: React.MouseEvent,
  //     node: ReactFlowNode,
  //     _nodes: ReactFlowNode[],
  //   ) => {
  //     const updatedData = {
  //       where: {
  //         id: node.id,
  //       },
  //       payload: {
  //         position: {
  //           x: Math.floor(node.position.x),
  //           y: Math.floor(node.position.y),
  //         },
  //       },
  //     };
  //     await updateNode.mutateAsync(updatedData);
  //   },
  //   [updateNode],
  // );

  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    type: "page" | "function" | "endpoint",
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("type", type);
  };

  return (
    <ReactFlow
      nodes={nodes}
      onNodesChange={onNodesChange}
      edges={showEdges ? edges : []}
      onEdgesChange={onEdgesChange}
      // onDrop={onDrop}
      // onNodeDragStop={onNodeDragStop}
      onDragOver={onDragOver}
      deleteKeyCode={null}
      nodeTypes={nodeTypes}
      panOnScroll={true}
      maxZoom={2}
      minZoom={0.1}
      fitView={true}
      fitViewOptions={{
        maxZoom: 1,
      }}
      colorMode={resolvedTheme as ColorMode}
    >
      <Background
        className="bg-muted dark:bg-background"
        color="hsl(var(--background))"
      />
      <Panel
        position="bottom-center"
        className="flex items-center gap-1 rounded-md border bg-background p-1 dark:bg-muted"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="inline-flex size-8 items-center justify-center rounded-md px-2 text-xs hover:cursor-grab hover:bg-accent hover:text-accent-foreground"
              onDragStart={(event) => onDragStart(event, "page")}
              draggable
            >
              <AppWindowIcon className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="border bg-muted">
            <p>Page</p>
          </TooltipContent>
        </Tooltip>

        {/* <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="inline-flex size-8 items-center justify-center rounded-md px-2 text-xs hover:cursor-grab hover:bg-accent hover:text-accent-foreground"
              onDragStart={(event) => onDragStart(event, "component")}
              draggable
            >
              <ComponentIcon className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="border bg-muted">
            <p>UI Component</p>
          </TooltipContent>
        </Tooltip> */}

        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="inline-flex size-8 items-center justify-center rounded-md px-2 text-xs hover:cursor-grab hover:bg-accent hover:text-accent-foreground"
              onDragStart={(event) => onDragStart(event, "function")}
              draggable
            >
              <FunctionSquareIcon className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="border bg-muted">
            <p>Function</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="inline-flex size-8 items-center justify-center rounded-md px-2 text-xs hover:cursor-grab hover:bg-accent hover:text-accent-foreground"
              onDragStart={(event) => onDragStart(event, "endpoint")}
              draggable
            >
              <span className="font-semibold text-[10px]">HTTP</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="border bg-muted">
            <p>Endpoint</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-9 border-l" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="size-8 rounded-md"
              variant="ghost"
              size="icon"
              onClick={toggleEdges}
            >
              {showEdges ? (
                <EyeIcon className="size-4" />
              ) : (
                <EyeOffIcon className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="border bg-muted">
            <p>Show edges</p>
          </TooltipContent>
        </Tooltip>

        <Button
          className="size-8 rounded-md"
          variant="ghost"
          size="icon"
          onClick={() => {
            zoomOut();
          }}
        >
          <MinusIcon className="size-4" />
        </Button>
        <Button
          className="h-8 rounded-md px-2 text-xs"
          variant="ghost"
          onClick={() => {
            fitView({
              maxZoom: 1,
            });
          }}
        >
          {`${Math.floor(viewPort.zoom * 100)}%`}
        </Button>
        <Button
          className="size-8 rounded-md"
          variant="ghost"
          size="icon"
          onClick={() => {
            zoomIn();
          }}
        >
          <PlusIcon className="size-4" />
        </Button>
      </Panel>
    </ReactFlow>
  );
}
