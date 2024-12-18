"use client";

import { createId } from "@paralleldrive/cuid2";
import type { ColorMode, Edge, Node as ReactFlowNode } from "@xyflow/react";
import {
  Background,
  MiniMap,
  Panel,
  ReactFlow,
  SmoothStepEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  EyeIcon,
  EyeOffIcon,
  FunctionSquareIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect } from "react";

import type { CanvasEdge, CanvasNode, CanvasNodeData } from "~/types";

import "@xyflow/react/dist/base.css";
import "~/styles/flow-builder.css";

import { Button } from "@integramind/ui/button";

import { useTheme } from "@integramind/ui/theme-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import { toast } from "@integramind/ui/use-toast";
import { useFlowBuilderStore } from "~/lib/store";
import { api } from "~/lib/trpc/client";
import { FuncNode } from "./func-node";

const nodeTypes = {
  func: FuncNode,
};

const edgeTypes = {
  smoothstep: SmoothStepEdge,
};

export function Canvas({
  moduleId,
  projectId,
  initialNodes,
  initialEdges,
}: {
  moduleId: string;
  projectId: string;
  initialNodes: CanvasNode[];
  initialEdges: CanvasEdge[];
}) {
  const showEdges = useFlowBuilderStore((state) => state.showEdges);
  const toggleEdges = useFlowBuilderStore((state) => state.toggleEdges);
  const { data: edgesData } = api.funcDependencies.byModuleId.useQuery(
    {
      id: moduleId,
    },
    {
      initialData: initialEdges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      })),
    },
  );

  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const viewPort = useViewport();
  const { resolvedTheme } = useTheme();
  const [nodes, setNodes, onNodesChange] =
    useNodesState<CanvasNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    showEdges ? [] : [],
  );

  useEffect(() => {
    setEdges(
      edgesData.map((edge) => ({
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
      })) as Edge[],
    );
  }, [edgesData, setEdges]);
  const apiUtils = api.useUtils();

  const createFunc = api.funcs.create.useMutation({
    onSuccess: () => {
      apiUtils.modules.byId.invalidate({
        id: moduleId,
      });
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
    onSuccess: () => {
      apiUtils.modules.byId.invalidate({
        id: moduleId,
      });
    },
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

      const newNodeId = createId();

      setNodes((nodes) =>
        nodes.concat({
          id: newNodeId,
          type: "func",
          position: { x: Math.floor(position.x), y: Math.floor(position.y) },
          data: {
            id: newNodeId,
            moduleId: moduleId,
            conversation: {},
          } as CanvasNodeData,
        }),
      );

      await createFunc.mutateAsync({
        id: newNodeId,
        moduleId,
        projectId,
        positionX: Math.floor(position.x),
        positionY: Math.floor(position.y),
      });
    },
    [createFunc, moduleId, setNodes, screenToFlowPosition, projectId],
  );

  const onNodeDragStop = useCallback(
    async (
      _event: React.MouseEvent,
      node: ReactFlowNode,
      _nodes: ReactFlowNode[],
    ) => {
      await updateFunc.mutateAsync({
        where: {
          id: node.id,
        },
        payload: {
          positionX: Math.floor(node.position.x),
          positionY: Math.floor(node.position.y),
        },
      });
    },
    [updateFunc],
  );

  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <ReactFlow
      className="rounded-md"
      nodes={nodes}
      onNodesChange={onNodesChange}
      edges={edges}
      onEdgesChange={onEdgesChange}
      edgeTypes={edgeTypes}
      onDrop={onDrop}
      onNodeDragStop={onNodeDragStop}
      onDragOver={onDragOver}
      deleteKeyCode={null}
      nodeTypes={nodeTypes}
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
          height: 110,
          width: 176,
        }}
      />
      <Panel
        position="bottom-right"
        className="flex flex-row items-center rounded-full border bg-background dark:bg-muted p-0.5 space-x-0.5"
      >
        <Button
          className="rounded-full"
          variant="ghost"
          size="icon"
          onClick={() => {
            zoomOut();
          }}
        >
          <MinusIcon className="size-4" />
        </Button>
        <Button
          className="w-[94px] rounded-full text-xs"
          variant="ghost"
          onClick={() => {
            fitView();
          }}
        >
          {`${Math.floor(viewPort.zoom * 100)}%`}
        </Button>
        <Button
          className="rounded-full"
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
        className="flex items-center bg-background dark:bg-muted rounded-full gap-0.5 p-0.5 border"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="inline-flex items-center text-xs justify-center h-9 px-2 rounded-full hover:bg-accent hover:text-accent-foreground hover:cursor-grab"
              onDragStart={onDragStart}
              draggable
            >
              <FunctionSquareIcon className="size-4 mr-2" />
              Function
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-muted border">
            <p>Function</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-9 border-l" />

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
        </Tooltip>
      </Panel>
    </ReactFlow>
  );
}
