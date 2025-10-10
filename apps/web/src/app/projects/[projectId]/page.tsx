import { TRPCError } from "@trpc/server";
import type { Edge } from "@xyflow/react";
import { notFound, redirect } from "next/navigation";

import type { NodeType } from "@weldr/shared/types";

import { ProjectView } from "@/components/projects/project-view";
import { api } from "@/lib/trpc/server";
import type { CanvasNode } from "@/types";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ versionId: string }>;
}): Promise<JSX.Element | undefined> {
  try {
    const { projectId } = await params;
    const { versionId } = await searchParams;
    const project = await api.projects.byId({ id: projectId, versionId });
    const integrationTemplates = await api.integrationTemplates.list();

    const initialNodes: CanvasNode[] =
      project.branch.headVersion?.declarations?.reduce<CanvasNode[]>(
        (acc, e) => {
          if (!e.declaration.metadata?.specs) return acc;

          acc.push({
            id: e.declaration.nodeId ?? "",
            type: e.declaration.metadata?.specs?.type as NodeType,
            data: e.declaration,
            position: e.declaration.node?.position ?? {
              x: 0,
              y: 0,
            },
          });

          return acc;
        },
        [],
      ) ?? [];

    const initialEdges: Edge[] =
      project.branch.headVersion?.edges?.map((edge) => ({
        id: `${edge.dependencyId}-${edge.dependentId}`,
        source: edge.dependencyId,
        target: edge.dependentId,
      })) ?? [];

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
