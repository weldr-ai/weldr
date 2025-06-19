import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { ProjectView } from "@/components/project-view";
import { api } from "@/lib/trpc/server";
import type { CanvasNode } from "@/types";
import type { Edge } from "@xyflow/react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  const project = await api.projects.byId({ id: projectId });

  return { title: `${project.title ?? "Untitled Project"} - Weldr` };
}

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
      project.activeVersion?.declarations?.reduce<CanvasNode[]>((acc, e) => {
        if (!e.declaration.specs) return acc;

        acc.push({
          id: e.declaration.canvasNodeId ?? "",
          type: `declaration-${e.declaration.specs.version}`,
          data: e.declaration,
          position: e.declaration.canvasNode?.position ?? {
            x: 0,
            y: 0,
          },
        });

        return acc;
      }, []) ?? [];

    const initialEdges: Edge[] =
      project.activeVersion?.edges?.map((edge) => ({
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
