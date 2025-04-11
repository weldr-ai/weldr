import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { ProjectView } from "@/components/project-view";
import { api } from "@/lib/trpc/server";
import type { CanvasNode } from "@/types";
import type { Edge } from "@xyflow/react";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<JSX.Element | undefined> {
  try {
    const { projectId } = await params;
    const project = await api.projects.byId({ id: projectId });
    const integrationTemplates = await api.integrationTemplates.list();

    const initialNodes: CanvasNode[] =
      project.declarations?.reduce<CanvasNode[]>((acc, declaration) => {
        if (!declaration.specs) return acc;

        acc.push({
          id: declaration.canvasNodeId ?? "",
          type: `declaration-${declaration.specs.version}`,
          data: declaration,
          position: declaration.canvasNode?.position ?? {
            x: 0,
            y: 0,
          },
        });

        return acc;
      }, []) ?? [];
    const initialEdges: Edge[] = [];

    if (project.currentVersion) {
      initialNodes.push({
        id: "preview",
        type: "preview" as const,
        position: {
          x: 0,
          y: 0,
        },
        data: {
          type: "preview",
          projectId: project.id,
          machineId: project.currentVersion.machineId,
        },
      });
    }

    return (
      <ProjectView
        project={project}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        integrationTemplates={integrationTemplates}
      />
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
