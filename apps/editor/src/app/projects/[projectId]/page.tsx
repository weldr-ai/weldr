import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { Canvas } from "@/components/canvas";
import { api } from "@/lib/trpc/server";
import type { CanvasNode } from "@/types";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<JSX.Element | undefined> {
  try {
    const { projectId } = await params;

    const project = await api.projects.byId({
      id: projectId,
    });

    const dependencies = await api.projects.dependencies({
      id: projectId,
    });

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

    for (const func of project.funcs) {
      initialNodes.push({
        type: "func",
        id: func.id,
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
          initialDependencies={dependencies}
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
