import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { Canvas } from "~/components/canvas";
import { api } from "~/lib/trpc/server";
import type { CanvasEdge, CanvasNode, CanvasNodeData } from "~/types";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}): Promise<JSX.Element | undefined> {
  try {
    const { moduleId } = await params;
    const module = await api.modules.byId({
      id: moduleId,
    });

    const initialEdges: CanvasEdge[] = module.edges.map((edge) => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
    }));

    const initialNodes: CanvasNode[] = module.funcs.map((func) => ({
      id: func.id,
      type: "func",
      dragHandle: ".drag-handle",
      position: { x: func.positionX ?? 0, y: func.positionY ?? 0 },
      data: func as unknown as CanvasNodeData,
    }));

    return (
      <div className="flex size-full">
        <Canvas
          moduleId={moduleId}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
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
