"use client";

import { useTRPC } from "@/lib/trpc/react";
import type { CanvasNode } from "@/types";
import { Button } from "@weldr/ui/components/button";
import { toast } from "@weldr/ui/hooks/use-toast";
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
import { MinusIcon, PlusIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DbModelNode } from "./nodes/declaration/db-model";
import { EndpointNode } from "./nodes/declaration/endpoint";
import { PageNode } from "./nodes/declaration/page";

import { useMutation } from "@tanstack/react-query";

import "@xyflow/react/dist/base.css";
import { useTheme } from "next-themes";

import type { RouterOutputs } from "@weldr/api";
import "@weldr/ui/styles/canvas.css";
import { Chat } from "../chat";
import { Placeholder } from "./placeholder";

const nodeTypes = {
  endpoint: EndpointNode,
  "db-model": DbModelNode,
  page: PageNode,
};

export function Canvas({
  initialNodes,
  initialEdges,
  project,
  integrationTemplates,
  environmentVariables,
}: {
  initialNodes: CanvasNode[];
  initialEdges: Edge[];
  project: RouterOutputs["projects"]["byId"];
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const viewPort = useViewport();
  const { resolvedTheme } = useTheme();
  const [nodes, _setNodes, onNodesChange] =
    useNodesState<CanvasNode>(initialNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const trpc = useTRPC();

  const updateNode = useMutation(
    trpc.nodes.update.mutationOptions({
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    }),
  );

  // Create edges with conditional opacity based on hovered node and expanded state
  const styledEdges = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      style: {
        ...edge.style,
        opacity:
          // Hide edges if either connected node is expanded
          expandedNodes.has(edge.source) || expandedNodes.has(edge.target)
            ? 0
            : // Show edges only when hovering over connected nodes
              hoveredNode &&
                (edge.source === hoveredNode || edge.target === hoveredNode)
              ? 1
              : 0,
        transition: "opacity 0.3s ease-in-out",
      },
    }));
  }, [edges, hoveredNode, expandedNodes]);

  const onNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: CanvasNode) => {
      setHoveredNode(node.id);
    },
    [],
  );

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const onNodeExpand = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => new Set(prev).add(nodeId));
  }, []);

  const onNodeCollapse = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      newSet.delete(nodeId);
      return newSet;
    });
  }, []);

  // Add expand/collapse callbacks to node data
  const styledNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onExpand: () => onNodeExpand(node.id),
        onCollapse: () => onNodeCollapse(node.id),
      },
    }));
  }, [nodes, onNodeExpand, onNodeCollapse]);

  const onNodeDragStop = useCallback(
    async (
      _event: React.MouseEvent,
      node: CanvasNode,
      _nodes: CanvasNode[],
    ) => {
      const updatedData = {
        where: {
          id: node.id,
        },
        payload: {
          position: {
            x: Math.floor(node.position.x),
            y: Math.floor(node.position.y),
          },
        },
      };

      await updateNode.mutateAsync(updatedData);
    },
    [updateNode],
  );

  return (
    <ReactFlow
      className="scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-transparent bg-background dark:bg-muted"
      nodes={styledNodes}
      onNodesChange={onNodesChange}
      edges={styledEdges}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
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
      {nodes.length === 0 && <Placeholder />}
      <Background
        color={
          resolvedTheme === "dark"
            ? "var(--color-background)"
            : "var(--color-muted)"
        }
        bgColor={
          resolvedTheme === "dark"
            ? "var(--color-background)"
            : "var(--color-muted)"
        }
      />

      <Panel position="bottom-center" className="max-h-[400px] w-[500px]">
        <Chat
          project={project}
          integrationTemplates={integrationTemplates}
          version={project.activeVersion}
          environmentVariables={environmentVariables}
        />
      </Panel>

      <Panel
        position="bottom-right"
        className="flex items-center rounded-lg border bg-background"
      >
        <Button
          className="size-9 rounded-r-none rounded-l-lg"
          variant="ghost"
          size="icon"
          disabled={!nodes.length}
          onClick={() => {
            zoomOut();
          }}
        >
          <MinusIcon className="size-3.5" />
        </Button>
        <Button
          className="h-9 rounded-none px-2 text-xs"
          variant="ghost"
          disabled={!nodes.length}
          onClick={() => {
            fitView({
              maxZoom: 1,
            });
          }}
        >
          {`${Math.floor(viewPort.zoom * 100)}%`}
        </Button>
        <Button
          className="size-9 rounded-r-lg rounded-l-none"
          variant="ghost"
          disabled={!nodes.length}
          size="icon"
          onClick={() => {
            zoomIn();
          }}
        >
          <PlusIcon className="size-3.5" />
        </Button>
      </Panel>
    </ReactFlow>
  );
}
