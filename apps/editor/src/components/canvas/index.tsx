"use client";

import { createId } from "@paralleldrive/cuid2";
import type { ColorMode, Node as ReactFlowNode } from "@xyflow/react";
import {
  Background,
  Panel,
  ReactFlow,
  SmoothStepEdge,
  useNodesState,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  AppWindowIcon,
  ComponentIcon,
  FunctionSquareIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import type React from "react";
import { useCallback } from "react";

import type { CanvasNode, CanvasNodeData } from "@/types";

import "@/styles/flow-builder.css";
import "@xyflow/react/dist/base.css";

import { Button } from "@integramind/ui/button";

import { api } from "@/lib/trpc/client";
import { toast } from "@integramind/ui/hooks/use-toast";
import { useTheme } from "@integramind/ui/theme-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import { EndpointNode } from "./nodes/endpoint";
import { FuncNode } from "./nodes/func";

const nodeTypes = {
  func: FuncNode,
  endpoint: EndpointNode,
};

const edgeTypes = {
  smoothstep: SmoothStepEdge,
};

export function Canvas({
  projectId,
  initialNodes,
}: {
  projectId: string;
  initialNodes: CanvasNode[];
}) {
  const { screenToFlowPosition, zoomIn, zoomOut, fitView, updateNodeData } =
    useReactFlow();
  const viewPort = useViewport();
  const { resolvedTheme } = useTheme();
  const [nodes, setNodes, onNodesChange] =
    useNodesState<CanvasNode>(initialNodes);

  const apiUtils = api.useUtils();

  const createFunc = api.funcs.create.useMutation({
    onSuccess: (data) => {
      updateNodeData(data.id, data);
      apiUtils.funcs.byId.invalidate({ id: data.id });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateFunc = api.funcs.update.useMutation({
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createEndpoint = api.endpoints.create.useMutation({
    onSuccess: (data) => {
      updateNodeData(data.id, data);
      apiUtils.endpoints.byId.invalidate({ id: data.id });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEndpoint = api.endpoints.update.useMutation({
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const type = event.dataTransfer.getData("type") as
        | "page"
        | "component"
        | "func"
        | "endpoint";

      const newNodeId = createId();
      let newNode: CanvasNode;

      switch (type) {
        case "func": {
          newNode = {
            id: newNodeId,
            type: "func",
            dragHandle: ".drag-handle",
            position: {
              x: Math.floor(position.x),
              y: Math.floor(position.y),
            },
            data: {
              id: newNodeId,
              projectId,
              conversation: {},
            },
          } as CanvasNode;
          setNodes((nodes) => nodes.concat(newNode));
          await createFunc.mutateAsync({
            id: newNodeId,
            projectId,
            positionX: Math.floor(position.x),
            positionY: Math.floor(position.y),
          });
          break;
        }
        case "endpoint":
          {
            newNode = {
              id: newNodeId,
              type: "endpoint",
              dragHandle: ".drag-handle",
              position: {
                x: Math.floor(position.x),
                y: Math.floor(position.y),
              },
              data: {
                id: newNodeId,
                projectId,
                conversation: {},
              } as CanvasNodeData,
            } as CanvasNode;
            await createEndpoint.mutateAsync({
              id: newNodeId,
              projectId,
              positionX: Math.floor(position.x),
              positionY: Math.floor(position.y),
            });
          }
          break;
      }

      setNodes((nodes) => nodes.concat(newNode));
    },
    [createEndpoint, createFunc, setNodes, screenToFlowPosition, projectId],
  );

  const onNodeDragStop = useCallback(
    async (
      _event: React.MouseEvent,
      node: ReactFlowNode,
      _nodes: ReactFlowNode[],
    ) => {
      const updatedData = {
        where: {
          id: node.id,
        },
        payload: {
          positionX: Math.floor(node.position.x),
          positionY: Math.floor(node.position.y),
        },
      };

      if (node.type === "func") {
        await updateFunc.mutateAsync(updatedData);
      }

      if (node.type === "endpoint") {
        await updateEndpoint.mutateAsync(updatedData);
      }
    },
    [updateEndpoint, updateFunc],
  );

  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    type: "page" | "component" | "func" | "endpoint",
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("type", type);
  };

  return (
    <ReactFlow
      className="rounded-md"
      nodes={nodes}
      onNodesChange={onNodesChange}
      edgeTypes={edgeTypes}
      onDrop={onDrop}
      onNodeDragStop={onNodeDragStop}
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
        position="bottom-right"
        className="flex items-center gap-1 rounded-md border bg-background p-1 dark:bg-muted"
      >
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
          className="h-8 rounded-md text-xs"
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

        <Tooltip>
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
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="inline-flex size-8 items-center justify-center rounded-md px-2 text-xs hover:cursor-grab hover:bg-accent hover:text-accent-foreground"
              onDragStart={(event) => onDragStart(event, "func")}
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
              <span className="size-4 font-semibold">API</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="border bg-muted">
            <p>Endpoint</p>
          </TooltipContent>
        </Tooltip>

        {/* <div className="h-9 border-l" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="rounded-full"
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
          <TooltipContent side="top" className="bg-muted border">
            <p>Show edges</p>
          </TooltipContent>
        </Tooltip> */}
      </Panel>
    </ReactFlow>
  );
}
