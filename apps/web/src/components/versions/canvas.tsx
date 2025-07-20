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
import { hierarchy, tree } from "d3-hierarchy";
import { ArrowLeftIcon, MinusIcon, PlusIcon } from "lucide-react";

import type { RouterOutputs } from "@weldr/api";
import { Button } from "@weldr/ui/components/button";

import "@xyflow/react/dist/base.css";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@weldr/ui/components/tooltip";
import "@weldr/ui/styles/canvas.css";
import { useTheme } from "next-themes";

import { type TVersionNode, VersionNode } from "./node";

type VersionEdge = Edge & {
  source: string;
  target: string;
};

interface HierarchyNode {
  id: string;
  version: RouterOutputs["versions"]["list"][number];
  children?: HierarchyNode[];
}

const nodeTypes = {
  version: VersionNode,
};

export function VersionsCanvas({
  versions,
}: {
  versions: RouterOutputs["versions"]["list"];
}) {
  const { resolvedTheme } = useTheme();

  const rootVersions = versions.filter((v) => !v.parentVersionId);

  const buildHierarchy = (
    version: RouterOutputs["versions"]["list"][number],
  ): HierarchyNode => {
    const children = versions
      .filter((v) => v.parentVersionId === version.id)
      .map(buildHierarchy);

    return {
      id: version.id,
      version,
      children: children.length ? children : undefined,
    };
  };

  const rootNodes = rootVersions.map(buildHierarchy);

  const hierarchies = rootNodes.map((root) => hierarchy(root));

  const treeLayout = tree<HierarchyNode>().nodeSize([400, 200]);

  const layouts = hierarchies.map((h) => treeLayout(h));

  const initialNodes: TVersionNode[] = [];
  const initialEdges: VersionEdge[] = [];

  for (const layout of layouts) {
    for (const node of layout.descendants()) {
      initialNodes.push({
        id: node.data.id,
        type: "version",
        position: { x: node.x, y: node.y },
        data: node.data.version,
      });

      if (node.parent) {
        const edge = {
          id: `${node.parent.data.id}-${node.data.id}`,
          source: node.parent.data.id,
          target: node.data.id,
          type: "smoothstep",
        };
        initialEdges.push(edge);
      }
    }
  }

  const viewPort = useViewport();
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <ReactFlow
      className="rounded-xl border"
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      panOnScroll={true}
      maxZoom={2}
      minZoom={0.1}
      fitView={true}
      fitViewOptions={{
        maxZoom: 1,
      }}
      nodesDraggable={false}
      nodesConnectable={false}
      defaultEdgeOptions={{
        type: "smoothstep",
      }}
      colorMode={resolvedTheme as ColorMode}
    >
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

      <Panel position="top-right" className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.history.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeftIcon className="size-4" />
              Go Back
            </Button>
          </TooltipTrigger>
          <TooltipContent className="border bg-background">
            <p>Go back to project</p>
          </TooltipContent>
        </Tooltip>
      </Panel>

      <Panel position="bottom-right" className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 rounded-md border bg-background p-0.5 dark:bg-muted">
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
        </div>
      </Panel>
    </ReactFlow>
  );
}
