"use client";

import { useTRPC } from "@/lib/trpc/react";
import { Badge } from "@weldr/ui/components/badge";
import { Button } from "@weldr/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@weldr/ui/components/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@weldr/ui/components/dialog";
import { ScrollArea } from "@weldr/ui/components/scroll-area";
import { cn } from "@weldr/ui/lib/utils";
import type { ColorMode, Edge } from "@xyflow/react";
import {
  Background,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { X } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";

import "@weldr/ui/styles/canvas.css";
import "@xyflow/react/dist/base.css";

interface CircleNodeData {
  label: string;
  isMain?: boolean;
  type?: string;
}

// Circle node component for the expanded canvas
const CircleNode = ({ data, selected }: { data: CircleNodeData; selected: boolean }) => {
  return (
    <div
      className={cn(
        "flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-2 bg-background text-xs font-medium transition-all hover:scale-110",
        {
          "border-primary bg-primary/10": selected,
          "border-muted-foreground": !selected,
        }
      )}
    >
      <span className="text-center leading-tight">{data.label}</span>
    </div>
  );
};

const nodeTypes = {
  circle: CircleNode,
};

interface DeclarationDetails {
  id: string;
  name: string;
  type: string;
  description?: string;
  specs?: {
    data?: {
      route?: string;
      path?: string;
      method?: string;
      description?: string;
      name?: string;
      type?: string;
    };
  };
}

interface ExpandedCanvasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  declarationId: string;
  declarationName: string;
  projectId: string;
}

export function ExpandedCanvasDialog({
  open,
  onOpenChange,
  declarationId,
  declarationName,
  projectId,
}: ExpandedCanvasDialogProps) {
  const { resolvedTheme } = useTheme();
  const trpc = useTRPC();
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedDeclaration, setSelectedDeclaration] = useState<DeclarationDetails | null>(null);

  // Fetch declaration dependencies
  const { data: dependencies } = trpc.declarations.getDependencies.useQuery(
    { id: declarationId },
    { enabled: open }
  );

  // Fetch declaration integrations
  const { data: integrations } = trpc.declarations.getIntegrations.useQuery(
    { id: declarationId },
    { enabled: open }
  );

  // Create nodes and edges for the dependency graph
  const { nodes, edges } = useMemo(() => {
    if (!dependencies) return { nodes: [], edges: [] };

    const nodeMap = new Map();
    const edgeList: Edge[] = [];

    // Add the main declaration as the center node
    nodeMap.set(declarationId, {
      id: declarationId,
      type: "circle",
      position: { x: 400, y: 300 },
      data: {
        label: declarationName,
        isMain: true,
      },
    });

    // Add dependency nodes in a circle around the main node
    const radius = 150;
    const angleStep = (2 * Math.PI) / Math.max(dependencies.length, 1);

    for (let index = 0; index < dependencies.length; index++) {
      const dep = dependencies[index];
      const angle = index * angleStep;
      const x = 400 + radius * Math.cos(angle);
      const y = 300 + radius * Math.sin(angle);

      nodeMap.set(dep.id, {
        id: dep.id,
        type: "circle",
        position: { x, y },
        data: {
          label: dep.name || dep.specs?.data?.name || "Unknown",
          type: dep.specs?.data?.type || "unknown",
        },
      });

      // Add edge from dependency to main declaration
      edgeList.push({
        id: `${dep.id}-${declarationId}`,
        source: dep.id,
        target: declarationId,
        type: "smoothstep",
        animated: true,
      });
    }

    return {
      nodes: Array.from(nodeMap.values()),
      edges: edgeList,
    };
  }, [dependencies, declarationId, declarationName]);

  const [reactFlowNodes, setNodes] = useNodesState(nodes);
  const [reactFlowEdges, setEdges] = useEdgesState(edges);

  // Update nodes when dependencies change
  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  const onNodeClick = useCallback(async (event: React.MouseEvent, node: { id: string; data: CircleNodeData }) => {
    setSelectedNodeId(node.id);
    
    if (node.id === declarationId) {
      // Main declaration clicked
      const declaration = await trpc.declarations.byId.query({ id: declarationId });
      setSelectedDeclaration({
        id: declaration.id,
        name: declarationName,
        type: declaration.specs?.data?.type || "unknown",
        description: declaration.specs?.data?.description,
        specs: declaration.specs,
      });
    } else {
      // Dependency clicked
      const dependency = dependencies?.find((dep) => dep.id === node.id);
      if (dependency) {
        setSelectedDeclaration({
          id: dependency.id,
          name: dependency.name || dependency.specs?.data?.name || "Unknown",
          type: dependency.specs?.data?.type || "unknown",
          description: dependency.specs?.data?.description,
          specs: dependency.specs,
        });
      }
    }
  }, [declarationId, declarationName, dependencies, trpc.declarations.byId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedDeclaration(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Dependencies: {declarationName}</span>
                         <div className="flex items-center gap-2">
               {integrations?.map((integration) => (
                 <Badge key={integration.id} variant="secondary" className="text-xs">
                   {integration.name}
                 </Badge>
               ))}
             </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative flex-1">
          <ReactFlow
            nodes={reactFlowNodes}
            edges={reactFlowEdges}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            colorMode={resolvedTheme as ColorMode}
            panOnScroll={true}
            maxZoom={2}
            minZoom={0.5}
            className="bg-background"
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
          </ReactFlow>

          {/* Declaration details popup */}
          {selectedDeclaration && (
            <Card className="absolute bottom-4 right-4 w-80 max-h-64">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{selectedDeclaration.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setSelectedNodeId(null);
                      setSelectedDeclaration(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="text-xs">
                  {selectedDeclaration.type}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-32">
                  <div className="space-y-2 text-sm">
                    {selectedDeclaration.description && (
                      <p className="text-muted-foreground">
                        {selectedDeclaration.description}
                      </p>
                    )}
                    {selectedDeclaration.specs?.data?.route && (
                      <div>
                        <span className="font-medium">Route: </span>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {selectedDeclaration.specs.data.route}
                        </code>
                      </div>
                    )}
                    {selectedDeclaration.specs?.data?.path && (
                      <div>
                        <span className="font-medium">Path: </span>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {selectedDeclaration.specs.data.path}
                        </code>
                      </div>
                    )}
                    {selectedDeclaration.specs?.data?.method && (
                      <div>
                        <span className="font-medium">Method: </span>
                        <Badge variant="outline" className="text-xs">
                          {selectedDeclaration.specs.data.method.toUpperCase()}
                        </Badge>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}