import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { Canvas } from "@/components/canvas";
import { api } from "@/lib/trpc/server";
import type { CanvasNode } from "@/types";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<JSX.Element | undefined> {
  try {
    const { projectId } = await params;

    const project = await api.projects.byId({
      id: projectId,
    });

    // const initialEdges: CanvasEdge[] = nodes.edges.map((edge) => ({
    //   id: `${edge.source}-${edge.target}`,
    //   source: edge.source,
    //   target: edge.target,
    // }));

    const initialNodes: CanvasNode[] = [];

    for (const endpoint of project.endpoints) {
      initialNodes.push({
        type: "endpoint",
        id: endpoint.id,
        dragHandle: ".drag-handle",
        position: { x: endpoint.positionX ?? 0, y: endpoint.positionY ?? 0 },
        data: endpoint,
      });
    }

    for (const module of project.modules) {
      initialNodes.push({
        type: "module",
        id: module.id,
        dragHandle: ".drag-handle",
        position: { x: module.positionX ?? 0, y: module.positionY ?? 0 },
        width: module.width ?? 600,
        height: module.height ?? 400,
        data: module,
      });
    }

    for (const func of project.funcs) {
      initialNodes.push({
        type: "func",
        id: func.id,
        parentId: func.moduleId,
        extent: "parent",
        dragHandle: ".drag-handle",
        position: { x: func.positionX ?? 0, y: func.positionY ?? 0 },
        data: func,
      });
    }

    return (
      <div className="flex size-full">
        <Canvas
          projectId={projectId}
          initialNodes={initialNodes}
          // initialEdges={initialEdges}
        />
      </div>
    );
  } catch (error) {
    console.error(error);
    if (error instanceof TRPCError) {
      switch (error.code) {
        // biome-ignore lint/suspicious/noFallthroughSwitchClause: notFound function already returns
        case "NOT_FOUND":
          notFound();
        case "UNAUTHORIZED":
        // biome-ignore lint/suspicious/noFallthroughSwitchClause: redirect function already returns
        case "FORBIDDEN":
          redirect("/auth/sign-in");
        default:
          return <div>Error</div>;
      }
    }
    return <div>Error</div>;
  }
}
